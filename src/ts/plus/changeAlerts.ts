// plus: bandeja de cambios (F11) y avisos cuando otra persona edita objetos.
// Cada espacio tiene una suscripción a los objetos que modificó alguien que no soy yo, del más nuevo al más viejo.
// - Bandeja: lo posterior a «visto hasta» (guardado por espacio en el almacenamiento local, sale de las fechas de
//   modificación recibidas, no del reloj local). Así se ve también lo que cambió con la app cerrada.
// - Avisos emergentes: solo lo que cambia con la app abierta, según el modo de cada espacio (Ajustes → Personal).
// Límite: no hay servidor propio; lo editado con la app cerrada llega al abrirla, cuando Anytype sincroniza.

import { observable, reaction, runInAction, IReactionDisposer } from 'mobx';
import * as I from 'Interface';
import Storage from 'Lib/storage';
import { t } from './text';
import { PlusChange, PlusInboxState, emptyState, normalizeState, inboxChanges, countUnread, markSeen, markAllSeen } from './changesInbox';

export type { PlusChange } from './changesInbox';

export type PlusAlertMode = '' | 'all' | 'types';

export interface PlusAlertConfig {
	mode: PlusAlertMode;
	types: string[];
};

const STORAGE_KEY = 'plusChangeAlerts';
const INBOX_KEY = 'plusChangeInbox';
const SUB_PREFIX = 'plus-changes-';
const LIMIT = 200;
// Mientras alguien escribe, el objeto cambia a cada rato: un aviso por objeto cada 5 minutos como máximo
const QUIET_MS = 5 * 60 * 1000;
// El resumen de lo que cambió con la app cerrada sale una sola vez, cuando dejan de llegar cambios viejos. Lo
// editado con la app cerrada llega cuando Anytype sincroniza, a veces varios segundos después de abrir: el resumen
// espera hasta 2 minutos.
const SUMMARY_MS = 4 * 1000;
const SUMMARY_WINDOW_MS = 2 * 60 * 1000;

const KEYS = [ 'id', 'name', 'type', 'layout', 'resolvedLayout', 'iconEmoji', 'spaceId', 'lastModifiedDate', 'lastModifiedBy' ];

/** Cambios de otras personas por espacio (todo lo que trae la suscripción, sin filtrar por «visto hasta»). */
export const spaceChanges = observable.map<string, PlusChange[]>({}, { deep: false });

/** «Visto hasta» y objetos vistos, por espacio. */
export const inboxStates = observable.map<string, PlusInboxState>({}, { deep: false });

const disposers: Map<string, IReactionDisposer> = new Map();
const lastSeen: Map<string, number> = new Map();
const lastAlert: Map<string, number> = new Map();
let spacesDisposer: IReactionDisposer = null;
let summaryTimer = 0;
let summaryPending = false;
let startedAt = 0;

// ---------------------------------------------------------------- configuración de avisos

export const getAlertConfig = (spaceId: string): PlusAlertConfig => {
	const all = Storage.get(STORAGE_KEY) || {};
	const item = all[spaceId] || {};
	const mode: PlusAlertMode = [ 'all', 'types' ].includes(item.mode) ? item.mode : '';

	return { mode, types: Array.isArray(item.types) ? item.types.map(String) : [] };
};

export const setAlertConfig = (spaceId: string, config: PlusAlertConfig) => {
	const all = { ...(Storage.get(STORAGE_KEY) || {}) };

	all[spaceId] = { mode: config.mode, types: config.types };
	Storage.set(STORAGE_KEY, all);
};

// ---------------------------------------------------------------- estado de la bandeja

const readStates = (): Record<string, any> => {
	const all = Storage.get(INBOX_KEY);
	return (all && (typeof all == 'object')) ? all : {};
};

const hasStoredState = (spaceId: string): boolean => !!readStates()[spaceId];

export const getInboxState = (spaceId: string): PlusInboxState => {
	return inboxStates.get(spaceId) || normalizeState(readStates()[spaceId]);
};

const saveInboxState = (spaceId: string, state: PlusInboxState) => {
	const all = { ...readStates() };

	all[spaceId] = state;
	Storage.set(INBOX_KEY, all);
	runInAction(() => inboxStates.set(spaceId, state));
};

/** Lo que muestra la bandeja de un espacio: posterior a «visto hasta», del más nuevo al más viejo. */
export const getInbox = (spaceId: string): PlusChange[] => {
	return inboxChanges(spaceChanges.get(spaceId) || [], getInboxState(spaceId));
};

export const getUnreadCount = (spaceId: string): number => {
	return countUnread(getInbox(spaceId), getInboxState(spaceId));
};

/** Espacios con bandeja (todos los vigilados). */
export const getInboxSpaces = (): string[] => Array.from(spaceChanges.keys());

export const markChangeSeen = (change: Pick<PlusChange, 'id' | 'spaceId' | 'date'>) => {
	saveInboxState(change.spaceId, markSeen(getInboxState(change.spaceId), change));
};

export const markSpaceSeen = (spaceId: string) => {
	saveInboxState(spaceId, markAllSeen(getInboxState(spaceId), spaceChanges.get(spaceId) || []));
};

// ---------------------------------------------------------------- suscripciones

const subId = (spaceId: string) => `${SUB_PREFIX}${spaceId}`;

export const changesSubId = subId;

const stopSpace = (spaceId: string) => {
	disposers.get(spaceId)?.();
	disposers.delete(spaceId);
	U.Subscription.destroyList([ subId(spaceId) ]);
	runInAction(() => spaceChanges.delete(spaceId));
};

/** Arma (o rearma) la suscripción de un espacio. Todos los espacios tienen bandeja; el modo solo decide los avisos. */
export const watchSpace = (spaceId: string) => {
	stopSpace(spaceId);

	const me = U.Space.getParticipantId(spaceId, S.Auth.account?.id);
	const id = subId(spaceId);
	const filters: I.Filter[] = [
		{ relationKey: 'resolvedLayout', condition: I.FilterCondition.NotIn, value: U.Object.getSystemLayouts() },
		{ relationKey: 'lastModifiedBy', condition: I.FilterCondition.NotEqual, value: me },
	];

	// Sin filtro de fecha: heart compara las fechas por día (o deja pasar todo con includeTime). La suscripción
	// trae los más recientes y aquí se separa lo que va a la bandeja y lo que se avisa.
	U.Subscription.subscribe({
		spaceId,
		subId: id,
		keys: KEYS,
		filters,
		sorts: [ { relationKey: 'lastModifiedDate', type: I.SortType.Desc } ],
		limit: LIMIT,
		// Con dependencias llegan el participante (quién) y el tipo (su nombre)
		noDeps: false,
	}, (message: any) => {
		if (message?.error?.code) {
			return;
		};

		onRecords(spaceId, true);
		disposers.set(spaceId, reaction(
			() => S.Record.getRecords(id, KEYS, true).map(it => `${it.id}|${it.lastModifiedDate}|${it.lastModifiedBy}`).join(','),
			() => onRecords(spaceId, false),
		));
	});
};

const toChange = (spaceId: string, record: any): PlusChange => {
	const id = subId(spaceId);
	const who = S.Detail.get(id, record.lastModifiedBy, [ 'name' ], true);
	const type = S.Detail.get(id, record.type, [ 'name' ], true);

	return {
		id: record.id,
		spaceId,
		name: U.Object.name(record),
		typeId: String(record.type || ''),
		typeName: type._empty_ ? '' : String(type.name || ''),
		who: who._empty_ ? t('alertSomeone') : String(who.name || t('alertSomeone')),
		whoId: String(record.lastModifiedBy || ''),
		layout: record.resolvedLayout ?? record.layout,
		iconEmoji: record.iconEmoji || '',
		date: Number(record.lastModifiedDate) || 0,
	};
};

const onRecords = (spaceId: string, isFirst: boolean) => {
	const changes = S.Record.getRecords(subId(spaceId), KEYS, true).map(it => toChange(spaceId, it)).filter(it => it.date);

	// Primera vez que se vigila este espacio en esta máquina: lo que ya existía cuenta como visto
	if (isFirst && !hasStoredState(spaceId)) {
		saveInboxState(spaceId, markAllSeen(emptyState(), changes));
	};

	runInAction(() => spaceChanges.set(spaceId, changes));

	if (isFirst) {
		queueSummary();
		for (const change of changes) {
			lastSeen.set(`${spaceId}:${change.id}`, change.date);
		};
		return;
	};

	alertNew(spaceId, changes);
};

// Avisos emergentes de lo que cambia con la app abierta
const alertNew = (spaceId: string, changes: PlusChange[]) => {
	const config = getAlertConfig(spaceId);
	const now = Date.now();

	for (const change of changes) {
		const key = `${spaceId}:${change.id}`;

		if (lastSeen.get(key) == change.date) {
			continue;
		};
		lastSeen.set(key, change.date);

		// Editado antes de abrir la app (llega con la sincronización): va al resumen, no a un aviso por objeto
		if (change.date * 1000 <= startedAt) {
			queueSummary();
			continue;
		};
		if (!config.mode) {
			continue;
		};
		if ((config.mode == 'types') && !config.types.includes(change.typeId)) {
			continue;
		};
		if (now - (lastAlert.get(key) || 0) < QUIET_MS) {
			continue;
		};
		lastAlert.set(key, now);
		queueChange(change);
	};
};

// Un solo aviso al abrir con lo que cambió mientras la app estaba cerrada
const queueSummary = () => {
	if (!summaryPending || (Date.now() > startedAt + SUMMARY_WINDOW_MS)) {
		return;
	};

	window.clearTimeout(summaryTimer);
	summaryTimer = window.setTimeout(() => {
		const total = getInboxSpaces().reduce((sum, spaceId) => sum + getUnreadCount(spaceId), 0);
		if (!total) {
			return;
		};

		summaryPending = false;

		const text = U.String.sprintf(t('inboxSummary'), total);

		if (S.Common.windowIsFocused) {
			Preview.toastShow({ text, action: I.ToastAction.None });
			return;
		};

		Renderer.send('notification', {
			id: `plus-changes-summary-${Date.now()}`,
			title: t('inboxTitle'),
			text,
			cmd: 'plusOpenRecent',
			payload: {},
		});
	}, SUMMARY_MS);
};

// ---------------------------------------------------------------- avisos agrupados

// Los cambios de una misma persona en un mismo espacio se juntan unos segundos y salen en un solo aviso: un sync
// externo edita muchas páginas de una vez con la cuenta de cada persona, y no hay forma de distinguir una edición
// por la API de una hecha a mano (el «origin» de Anytype es cómo se creó el objeto, no cómo se editó).
const GROUP_MS = 15 * 1000;
const pending: Map<string, { changes: PlusChange[]; timer: number }> = new Map();

export const queueChange = (change: PlusChange) => {
	const key = `${change.spaceId}:${change.who}`;
	const item = pending.get(key) || { changes: [], timer: 0 };

	item.changes = item.changes.filter(it => it.id != change.id).concat([ change ]);

	if (!item.timer) {
		item.timer = window.setTimeout(() => {
			pending.delete(key);
			notify(item.changes);
		}, GROUP_MS);
	};

	pending.set(key, item);
};

export const changeText = (change: PlusChange): string => {
	const space = U.Space.getSpaceviewBySpaceId(change.spaceId);
	return [ change.who, change.typeName, space?.name ].filter(it => it).join(' · ');
};

const notify = (changes: PlusChange[]) => {
	if (!changes.length) {
		return;
	};

	const last = changes[changes.length - 1];
	const isGroup = changes.length > 1;
	const space = U.Space.getSpaceviewBySpaceId(last.spaceId);
	const title = isGroup ? U.String.sprintf(t('alertGroupTitle'), last.who, changes.length) : U.String.sprintf(t('alertTitle'), last.name);
	const text = isGroup ? [ changes.slice(-3).reverse().map(it => it.name).join(', '), space?.name ].filter(it => it).join(' · ') : changeText(last);

	if (S.Common.windowIsFocused) {
		Preview.toastShow({ text: `${title} · ${text}`, action: I.ToastAction.None });
		return;
	};

	Renderer.send('notification', {
		id: `plus-change-${last.spaceId}-${last.id}-${last.date}-${changes.length}`,
		title,
		text,
		// Uno solo abre el objeto; varios abren la bandeja
		cmd: isGroup ? 'plusOpenRecent' : 'plusOpenObject',
		payload: { id: last.id, spaceId: last.spaceId, layout: last.layout, date: last.date },
	});
};

// ---------------------------------------------------------------- abrir

export const INBOX_ROUTE = '/main/plusChanges';

export const openRecent = () => {
	U.Router.go(INBOX_ROUTE, {});
};

export const openChange = (change: Pick<PlusChange, 'id' | 'spaceId' | 'layout'> & { date?: number }) => {
	if (change.date) {
		markChangeSeen({ id: change.id, spaceId: change.spaceId, date: change.date });
	};
	U.Object.openAuto({ id: change.id, spaceId: change.spaceId, layout: change.layout });
};

// ---------------------------------------------------------------- arranque

const watchedIds = (): string[] => U.Space.getList().map(it => it.targetSpaceId).filter(it => it);

/** Al iniciar sesión: vigila todos los espacios, y los que se sumen después. */
export const startChangeAlerts = () => {
	// Cada inicio de sesión empieza de cero (puede ser otra cuenta en el mismo proceso)
	spacesDisposer?.();
	for (const spaceId of Array.from(disposers.keys()).concat(Array.from(spaceChanges.keys()))) {
		stopSpace(spaceId);
	};
	for (const item of pending.values()) {
		window.clearTimeout(item.timer);
	};
	window.clearTimeout(summaryTimer);
	pending.clear();
	lastSeen.clear();
	lastAlert.clear();
	runInAction(() => {
		spaceChanges.clear();
		inboxStates.clear();
	});
	startedAt = Date.now();
	summaryPending = true;

	for (const spaceId of watchedIds()) {
		watchSpace(spaceId);
	};

	// Espacios a los que me uno (o que dejo) con la sesión abierta
	spacesDisposer = reaction(() => watchedIds().join(','), () => {
		const ids = watchedIds();

		for (const spaceId of ids) {
			if (!spaceChanges.has(spaceId) && !disposers.has(spaceId)) {
				watchSpace(spaceId);
			};
		};
		for (const spaceId of Array.from(spaceChanges.keys())) {
			if (!ids.includes(spaceId)) {
				stopSpace(spaceId);
			};
		};
	});
};

// ---------------------------------------------------------------- textos de fecha

/** «ahora», «hace 10 min», «hace 3 h» o, si es de otro día, la fecha corta de Anytype. */
export const agoText = (date: number): string => {
	const diff = Math.max(0, U.Date.now() - date);

	if (diff < 60) {
		return t('agoNow');
	};
	if (diff < 3600) {
		return U.String.sprintf(t('agoMin'), Math.floor(diff / 60));
	};
	if (U.Date.isToday(date)) {
		return U.String.sprintf(t('agoHour'), Math.floor(diff / 3600));
	};
	return U.Date.timeAgo(date);
};

/** «hoy a las 18:20», «ayer a las 18:20» o «el 12/11 a las 18:20». */
export const sinceText = (date: number): string => {
	const time = U.Date.date('H:i', date);

	if (U.Date.isToday(date)) {
		return U.String.sprintf(t('todayAt'), time);
	};
	if (U.Date.isToday(date + 86400)) {
		return U.String.sprintf(t('yesterdayAt'), time);
	};
	return U.String.sprintf(t('dateAt'), U.Date.date('d/m', date), time);
};
