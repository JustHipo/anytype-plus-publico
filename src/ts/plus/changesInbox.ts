// plus: funciones puras de la bandeja de cambios (F11), para poder probarlas con vitest.
// La bandeja muestra lo que otras personas editaron después de «visto hasta», un valor por espacio que sale de la
// fecha de modificación (lastModifiedDate, en segundos) de los cambios recibidos, nunca del reloj de esta máquina.

export interface PlusChange {
	id: string;
	spaceId: string;
	name: string;
	typeId: string;
	typeName: string;
	who: string;
	whoId: string;
	layout: number;
	iconEmoji?: string;
	date: number;
};

export interface PlusInboxState {
	// Fecha (segundos) del cambio más nuevo que ya se vio en este espacio: lo anterior no entra en la bandeja
	seenUntil: number;
	// Objetos vistos uno por uno después de seenUntil: id → fecha de la versión que se vio
	seen: Record<string, number>;
};

export interface PlusChangeGroup {
	key: string;
	spaceId: string;
	who: string;
	whoId: string;
	// Del más nuevo al más viejo
	changes: PlusChange[];
	date: number;
	unread: number;
};

// Una ráfaga: cambios seguidos de la misma persona con menos de esta distancia entre uno y otro (segundos).
// Es la misma ventana de 15 s de los avisos: una pasada de un sync externo queda en una sola entrada.
export const BURST_GAP = 15;

export const emptyState = (): PlusInboxState => ({ seenUntil: 0, seen: {} });

export const normalizeState = (value: any): PlusInboxState => {
	const seenUntil = Number(value?.seenUntil) || 0;
	const seen: Record<string, number> = {};

	if (value?.seen && (typeof value.seen == 'object')) {
		for (const [ id, date ] of Object.entries(value.seen)) {
			const n = Number(date) || 0;
			if (id && (n > seenUntil)) {
				seen[id] = n;
			};
		};
	};

	return { seenUntil, seen };
};

/** Un cambio está sin ver si es posterior a «visto hasta» y a la última vez que se abrió ese objeto. */
export const isUnread = (change: PlusChange, state: PlusInboxState): boolean => {
	return (change.date > state.seenUntil) && (change.date > (state.seen[change.id] || 0));
};

/** Lo que entra en la bandeja: posterior a «visto hasta», del más nuevo al más viejo. */
export const inboxChanges = (changes: PlusChange[], state: PlusInboxState): PlusChange[] => {
	return changes.filter(it => it.date > state.seenUntil).sort((a, b) => (b.date - a.date) || a.id.localeCompare(b.id));
};

export const countUnread = (changes: PlusChange[], state: PlusInboxState): number => {
	return changes.filter(it => isUnread(it, state)).length;
};

/**
 * Agrupa por persona y ráfaga. Recibe cambios de uno o varios espacios ya ordenados del más nuevo al más viejo;
 * una entrada sigue mientras el cambio siguiente es de la misma persona, en el mismo espacio y a menos de `gap`
 * segundos del anterior.
 */
export const groupChanges = (changes: PlusChange[], states: (spaceId: string) => PlusInboxState, gap = BURST_GAP): PlusChangeGroup[] => {
	const groups: PlusChangeGroup[] = [];
	let current: PlusChangeGroup = null;

	for (const change of changes) {
		const last = current?.changes[current.changes.length - 1];
		const same = current && (current.spaceId == change.spaceId) && (current.whoId == change.whoId) && ((last.date - change.date) <= gap);

		if (!same) {
			current = {
				key: `${change.spaceId}:${change.whoId}:${change.date}:${change.id}`,
				spaceId: change.spaceId,
				who: change.who,
				whoId: change.whoId,
				changes: [],
				date: change.date,
				unread: 0,
			};
			groups.push(current);
		};

		current.changes.push(change);
		if (isUnread(change, states(change.spaceId))) {
			current.unread++;
		};
	};

	return groups;
};

/** Al abrir un objeto de la bandeja: queda visto en la versión que se abrió. */
export const markSeen = (state: PlusInboxState, change: Pick<PlusChange, 'id' | 'date'>): PlusInboxState => {
	if (change.date <= state.seenUntil) {
		return state;
	};
	return { seenUntil: state.seenUntil, seen: { ...state.seen, [change.id]: Math.max(change.date, state.seen[change.id] || 0) } };
};

/** «Marcar todo como visto»: «visto hasta» pasa a la fecha del cambio más nuevo recibido (no a la hora local). */
export const markAllSeen = (state: PlusInboxState, changes: PlusChange[]): PlusInboxState => {
	const newest = changes.reduce((max, it) => Math.max(max, it.date), 0);
	return normalizeState({ seenUntil: Math.max(state.seenUntil, newest), seen: state.seen });
};

// ---------------------------------------------------------------- <anytype-changes>

// Fila por defecto: clases simples (.row, .e, .t, .m) para que las páginas HTML puedan darles estilo
export const CHANGES_TEMPLATE = '<a class="row {{unread}}" href="{{url}}"><span class="e">{{icon}}</span><span class="t">{{name}}</span><span class="m">{{who}} · {{when}}</span></a>';

const escape = (s: string): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]);

/** Llena la plantilla de una fila. Los valores se escapan; `url` es siempre un enlace anytype:// armado aquí. */
export const renderChangeRow = (template: string, values: Record<string, string>): string => {
	return String(template || CHANGES_TEMPLATE).replace(/\{\{\s*([a-z]+)\s*\}\}/g, (m: string, key: string) => escape(values[key] ?? ''));
};
