// plus: <anytype-list>, una lista propia hecha con HTML a partir de datos de Anytype.
//
//   <ul>
//     <anytype-list source="ID" limit="10" sort="name">
//       <li><a href="{{url}}">{{name}}</a> · {{description}}</li>
//     </anytype-list>
//   </ul>
//
// `source` es un tipo, una colección o un set. Lo que va dentro de la etiqueta se repite por cada objeto, con
// {{name}}, {{id}}, {{url}}, {{icon}} y cualquier propiedad por su clave de API o interna ({{done}}, {{origen}}…).
// `filter` usa la gramática compacta de la API: filter='estado_decision IN ("Vigente") AND name CONTAINS "DE-"'.
// Con un set de fuente se aplican además los filtros de su primera vista, y su orden si no viene `sort`.
// A diferencia de <anytype-view>, que es la vista nativa, aquí el aspecto lo pone el HTML y el CSS del autor:
// por eso el resultado se escribe dentro del shadow DOM. Los valores se escapan siempre, y la lista se
// actualiza sola cuando cambian los objetos.
//
// <anytype-folders> usa esta misma suscripción para dibujar un árbol de carpetas con la ruta de cada objeto:
//
//   <anytype-folders key="ruta_repo" source="ID_DEL_TIPO" root="docs" open="1"></anytype-folders>
//
// `key` es la propiedad con la ruta (por defecto `ruta_repo`); `source` y `filter` son opcionales (sin `source`,
// todo el espacio); `root` muestra solo lo que está bajo esa carpeta; `open` es cuántos niveles empiezan abiertos.

import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import * as I from 'Interface';
import { PlusList } from './htmlParse';
import { getObjectIdFromAttr } from './nativeSlot';
import { t } from './text';
import { resolveKey, renderItem, parseFilter, FILTER_CONDITION } from './listRender';
import { getApiKeyMap, optionIdsByName } from './apiKeys';
import { buildTree, renderTree } from './foldersRender';

interface Props {
	rootId: string;
	blockId: string;
	def: PlusList;
	getElement: () => HTMLElement;
	// Cambia cada vez que se reconstruye el shadow DOM (al editar el HTML): el elemento es nuevo y hay que volver a llenarlo
	renderKey?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const FOLDERS_LIMIT = 2000;
const FOLDERS_KEY = 'ruta_repo';

const PlusListFiller = observer((props: Props) => {

	const { rootId, blockId, def, getElement, renderKey } = props;
	const isFolders = (def.tag == 'anytype-folders');
	const sourceId = getObjectIdFromAttr(def.attrs.source || def.attrs.object);
	const limit = isFolders ? FOLDERS_LIMIT : Math.min(MAX_LIMIT, Math.max(1, Number(def.attrs.limit) || DEFAULT_LIMIT));
	// El espacio de la página (no el que esté activo): una página puede abrirse antes de que cambie el espacio
	const spaceId = S.Detail.get(rootId, rootId, [ 'spaceId' ], true).spaceId || S.Common.space;
	const apiKeyMap = getApiKeyMap(spaceId);
	const apiLoaded = apiKeyMap !== null;
	const apiKeys = apiKeyMap || new Map<string, string>();
	const sortKey = resolveKey(String(def.attrs.sort || '').replace(/^-/, ''), apiKeys);
	const sortDesc = String(def.attrs.sort || '').startsWith('-');
	const subId = [ 'plus-list', rootId, blockId, def.name ].join('-');
	const sourceSubId = `${subId}-source`;
	const pathKey = isFolders ? resolveKey(String(def.attrs.key || FOLDERS_KEY), apiKeys) : '';
	const templateKeys = isFolders ? [ pathKey ] : Array.from(def.template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(m => resolveKey(m[1], apiKeys));
	const filterText = String(def.attrs.filter || '');
	const keys = Array.from(new Set(J.Relation.default.concat(templateKeys).concat(sortKey ? [ sortKey ] : [])));
	const [ state, setState ] = useState<'loading' | 'ready' | 'error'>('loading');

	// filter="…": gramática de la API, con claves de API y nombres de opción
	const addFilters = (param: any) => {
		parseFilter(filterText).forEach(clause => {
			const relationKey = resolveKey(clause.key, apiKeys);
			const relation = S.Record.getRelationByKey(relationKey);
			const isOption = [ I.RelationType.Select, I.RelationType.MultiSelect ].includes(relation?.format);
			const condition = FILTER_CONDITION[clause.op];
			let values = clause.values;

			if (isOption) {
				values = optionIdsByName(relationKey, values.map(String));
			};

			// Una opción comparada con «=» es «está entre»
			const isList = [ I.FilterCondition.In, I.FilterCondition.NotIn, I.FilterCondition.AllIn ].includes(condition);
			const finalCondition = (isOption && (condition == I.FilterCondition.Equal)) ? I.FilterCondition.In : ((isOption && (condition == I.FilterCondition.NotEqual)) ? I.FilterCondition.NotIn : condition);
			const value = (isList || isOption) ? values : values[0];

			param.filters.push({ relationKey, condition: finalCondition, value });
		});
	};

	// 1) Saber qué es el origen (tipo, colección o set)  2) suscribirse a sus objetos
	useEffect(() => {
		// El árbol puede abarcar todo el espacio; la lista necesita un origen
		if (!sourceId && !isFolders) {
			setState('error');
			return;
		};

		setState('loading');

		// Sin el mapa de claves todavía, filtros y propiedades saldrían con la clave equivocada
		if (!apiLoaded) {
			return;
		};

		// Parámetros nuevos en cada suscripción: el aviso del origen puede llegar más de una vez
		const makeParam = (): any => {
			const param: any = {
				spaceId,
				subId,
				keys,
				limit,
				noDeps: false,
				filters: [ { relationKey: 'resolvedLayout', condition: I.FilterCondition.NotIn, value: U.Object.getSystemLayouts() } ],
				sorts: sortKey ? [ { relationKey: sortKey, type: sortDesc ? I.SortType.Desc : I.SortType.Asc } ] : [ { relationKey: 'lastModifiedDate', type: I.SortType.Desc } ],
			};

			// El árbol solo muestra objetos con ruta
			if (isFolders) {
				param.filters.push({ relationKey: pathKey, condition: I.FilterCondition.NotEmpty, value: null });
			};

			addFilters(param);
			return param;
		};

		// Si el efecto se rehace o la lista se desmonta, las respuestas que lleguen después no hacen nada
		let cancelled = false;
		const subscribe = (param: any) => {
			if (!cancelled) {
				U.Subscription.subscribe(param, () => !cancelled && setState('ready'));
			};
		};

		if (isFolders && !sourceId) {
			subscribe(makeParam());
			return () => {
				cancelled = true;
				U.Subscription.destroyList([ subId ]);
			};
		};

		U.Subscription.subscribeIds({
			spaceId,
			subId: sourceSubId,
			ids: [ sourceId ],
			keys: [ 'id', 'layout', 'resolvedLayout', 'setOf', 'spaceId' ],
			noDeps: true,
		}, () => {
			if (cancelled) {
				return;
			};

			const source = S.Detail.get(sourceSubId, sourceId, [ 'layout', 'resolvedLayout', 'setOf' ], true);

			if (source._empty_) {
				setState('error');
				return;
			};

			const layout = source.resolvedLayout ?? source.layout;
			const param = makeParam();

			if (U.Object.isTypeLayout(layout)) {
				param.filters.push({ relationKey: 'type', condition: I.FilterCondition.Equal, value: sourceId });
				subscribe(param);
			} else
			if (U.Object.isCollectionLayout(layout)) {
				param.collectionId = sourceId;
				subscribe(param);
			} else
			if (U.Object.isSetLayout(layout)) {
				param.sources = Relation.getArrayValue(source.setOf);

				// Filtros y orden de la primera vista del set
				const traceId = `plus-list-${blockId}-${def.name}`;
				const contextId = `${sourceId}-${traceId}`;

				C.ObjectShow(sourceId, traceId, spaceId, (message: any) => {
					Action.pageClose(false, contextId, false);

					if (cancelled) {
						return;
					};

					// Sin la vista del set no se conocen sus filtros: mejor un error que objetos de más
					if (message.error?.code) {
						setState('error');
						return;
					};

					const blocks = message.objectView?.blocks || [];
					const dataview = blocks.find((it: any) => it.content?.views?.length);
					const view = dataview?.content?.views?.[0];

					if (view) {
						param.filters = param.filters.concat((view.filters || []).filter((it: any) => it.relationKey));

						if (!sortKey && (view.sorts || []).length) {
							param.sorts = view.sorts.map((it: any) => ({ relationKey: it.relationKey, type: it.type }));
						};
					};

					subscribe(param);
				});
			} else {
				setState('error');
				return;
			};
		});

		return () => {
			cancelled = true;
			U.Subscription.destroyList([ subId, sourceSubId ]);
		};
	}, [ sourceId, limit, def.attrs.sort, filterText, apiLoaded, spaceId, keys.join(',') ]);

	const records = S.Record.getRecords(subId, keys, true);
	let html = '';

	if (state == 'ready') {
		if (isFolders) {
			const items = records.map(it => ({ id: it.id, name: U.Object.name(it), path: String(it[pathKey] || ''), icon: it.iconEmoji || '' }));
			const open = Math.max(0, Number(def.attrs.open ?? 1) || 0);

			html = `<div class="plus-folders">${renderTree(buildTree(items, def.attrs.root), spaceId, open)}</div>`;
		} else {
			html = records.map(it => renderItem(def.template, it, spaceId, subId, apiKeys)).join('');
		};
	};
	const message = (state == 'error') ? t('listError') : '';

	// El resultado va dentro del shadow DOM, donde manda el CSS del autor
	useEffect(() => {
		const el = getElement();
		if (!el) {
			return;
		};

		if (message) {
			el.textContent = message;
			return;
		};

		// Árbol: las carpetas que la persona abrió o cerró siguen así al redibujar
		const dirs = Array.from(el.querySelectorAll('details[data-path]')) as HTMLDetailsElement[];
		const known = new Map(dirs.map(it => [ it.getAttribute('data-path'), it.open ]));

		el.innerHTML = html;

		if (known.size) {
			(Array.from(el.querySelectorAll('details[data-path]')) as HTMLDetailsElement[]).forEach(it => {
				const path = it.getAttribute('data-path');
				if (known.has(path)) {
					it.open = known.get(path);
				};
			});
		};
	}, [ html, message, renderKey ]);

	return null;

});

export default PlusListFiller;
