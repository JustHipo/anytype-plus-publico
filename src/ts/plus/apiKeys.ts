// plus: claves de la API de Anytype dentro del HTML.
// Una propiedad creada por la API (o en la app) tiene una clave interna (un id como `6aff…`) y otra «de API»
// (`origen`, `estado_decision`), guardada en el dato `apiObjectKey`. El HTML usa la de la API, que es la que
// conocen el MCP y quien escribe el HTML; aquí se traduce a la interna. También se traducen nombres de
// opciones de select a sus ids, para filtrar.

import { observable, runInAction } from 'mobx';
import * as I from 'Interface';

const maps = observable.map<string, Map<string, string>>();
const loading: Set<string> = new Set();

const load = (spaceId: string) => {
	if (loading.has(spaceId)) {
		return;
	};

	loading.add(spaceId);

	const filters: any[] = [
		{ relationKey: 'resolvedLayout', condition: I.FilterCondition.Equal, value: I.ObjectLayout.Relation },
		{ relationKey: 'apiObjectKey', condition: I.FilterCondition.NotEmpty, value: null },
	];

	C.ObjectSearch(spaceId, filters, [], [ 'id', 'relationKey', 'apiObjectKey' ], '', 0, 0, (message: any) => {
		loading.delete(spaceId);

		const map = new Map<string, string>();
		(message.records || []).forEach((it: any) => {
			if (it.apiObjectKey && it.relationKey) {
				map.set(String(it.apiObjectKey), String(it.relationKey));
			};
		});

		runInAction(() => maps.set(spaceId, map));
	});
};

/**
 * Clave de API → clave interna, para el espacio dado. `null` mientras se consulta: quien lo usa debe esperar
 * (el mapa es observable, así que el componente se vuelve a dibujar solo cuando llega).
 */
export const getApiKeyMap = (spaceId: string): Map<string, string> | null => {
	if (!spaceId) {
		return null;
	};

	if (!maps.has(spaceId)) {
		load(spaceId);
		return null;
	};

	return maps.get(spaceId);
};

/** Vuelve a consultar el mapa (por ejemplo, después de crear propiedades nuevas). */
export const refreshApiKeyMap = (spaceId: string) => {
	runInAction(() => maps.delete(spaceId));
	load(spaceId);
};

/**
 * Ids de las opciones de una propiedad select o multi_select, a partir de sus nombres (o ids).
 */
export const optionIdsByName = (relationKey: string, names: string[]): string[] => {
	const options = S.Record.getRecords(U.Subscription.spaceSubId(J.Constant.subId.option), [ 'id', 'name', 'relationKey' ], true)
		.filter(it => it.relationKey == relationKey);

	return names.map(name => {
		const n = String(name || '').trim().toLowerCase();
		const option = options.find(it => (it.id == name) || (String(it.name || '').trim().toLowerCase() == n));

		return option ? option.id : String(name);
	});
};
