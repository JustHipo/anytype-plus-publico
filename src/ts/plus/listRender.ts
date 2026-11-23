// plus: funciones puras de <anytype-list> (sin componentes), para poder probarlas con vitest.

import * as I from 'Interface';

/**
 * Clave de una propiedad tal como la escribe el HTML → clave interna de Anytype.
 * Acepta la interna (createdDate), la de la API de las propiedades del sistema (created_date) y la de la API
 * de las propiedades propias del espacio (origen, estado_decision), que se busca en `apiKeys`.
 */
export const resolveKey = (key: string, apiKeys?: Map<string, string>): string => {
	const k = String(key || '');

	if (S.Record.getRelationByKey(k)) {
		return k;
	};

	const fromApi = apiKeys?.get(k);
	if (fromApi) {
		return fromApi;
	};

	if (k.includes('_')) {
		const camel = k.replace(/_([a-z0-9])/g, (m: string, c: string) => c.toUpperCase());
		if (S.Record.getRelationByKey(camel)) {
			return camel;
		};
	};

	return k;
};

export interface PlusFilterClause {
	key: string;
	op: string;
	values: any[];
};

const OPS = [ 'NOT CONTAINS', 'CONTAINS', 'NOT IN', 'ALL IN', 'IN', 'IS NOT EMPTY', 'IS EMPTY', 'NOT EMPTY', 'EMPTY', '!=', '>=', '<=', '=', '>', '<' ];

const parseValue = (raw: string): any => {
	const s = raw.trim();

	if (/^".*"$/.test(s) || /^'.*'$/.test(s)) {
		return s.slice(1, -1).replace(/\\(["'\\])/g, '$1');
	};
	if (/^(true|false)$/i.test(s)) {
		return /^true$/i.test(s);
	};
	if (/^-?\d+(\.\d+)?$/.test(s)) {
		return Number(s);
	};

	return s;
};

/** Separa por un carácter fuera de comillas. */
const splitOutsideQuotes = (s: string, sep: RegExp): string[] => {
	const out: string[] = [];
	let quote = '';
	let cur = '';

	for (let i = 0; i < s.length; i++) {
		const c = s[i];

		if (quote) {
			cur += c;
			if ((c == quote) && (s[i - 1] != '\\')) {
				quote = '';
			};
			continue;
		};

		if ((c == '"') || (c == '\'')) {
			quote = c;
			cur += c;
			continue;
		};

		const m = s.slice(i).match(sep);
		if (m && (m.index === 0)) {
			out.push(cur);
			cur = '';
			i += m[0].length - 1;
			continue;
		};

		cur += c;
	};

	out.push(cur);
	return out.map(it => it.trim()).filter(it => it);
};

/**
 * Gramática compacta de la API de Anytype, la misma del MCP:
 *   estado_decision IN ("Vigente", "Propuesta") AND name CONTAINS "DE-" AND done = false
 * Operadores: = != > < >= <= IN, NOT IN, ALL IN, CONTAINS, NOT CONTAINS, IS EMPTY, IS NOT EMPTY.
 */
export const parseFilter = (text: string): PlusFilterClause[] => {
	return splitOutsideQuotes(String(text || ''), /^\s+AND\s+/i).map(part => {
		const upper = part.toUpperCase();
		let found: { op: string; index: number } = null;

		for (const op of OPS) {
			const re = /^[A-Z]/.test(op) ? new RegExp(`\\s${op.replace(/ /g, '\\s+')}(\\s|\\(|$)`) : null;
			const index = re ? upper.search(re) : upper.indexOf(op);

			if ((index > 0) && (!found || (index < found.index))) {
				found = { op, index };
			};
		};

		if (!found) {
			return null;
		};

		const key = part.slice(0, found.index).trim();
		const rest = part.slice(found.index).trim().replace(new RegExp(`^${found.op.replace(/ /g, '\\s+')}`, 'i'), '').trim();
		const op = found.op.replace('IS NOT EMPTY', 'NOT EMPTY').replace('IS EMPTY', 'EMPTY');
		let values: any[] = [];

		if ([ 'IN', 'NOT IN', 'ALL IN' ].includes(op)) {
			values = splitOutsideQuotes(rest.replace(/^\(/, '').replace(/\)$/, ''), /^,/).map(parseValue);
		} else
		if (![ 'EMPTY', 'NOT EMPTY' ].includes(op)) {
			values = [ parseValue(rest) ];
		};

		return key ? { key, op, values } : null;
	}).filter(it => it);
};

export const FILTER_CONDITION: Record<string, I.FilterCondition> = {
	'=': I.FilterCondition.Equal,
	'!=': I.FilterCondition.NotEqual,
	'>': I.FilterCondition.Greater,
	'<': I.FilterCondition.Less,
	'>=': I.FilterCondition.GreaterOrEqual,
	'<=': I.FilterCondition.LessOrEqual,
	'CONTAINS': I.FilterCondition.Like,
	'NOT CONTAINS': I.FilterCondition.NotLike,
	'IN': I.FilterCondition.In,
	'NOT IN': I.FilterCondition.NotIn,
	'ALL IN': I.FilterCondition.AllIn,
	'EMPTY': I.FilterCondition.Empty,
	'NOT EMPTY': I.FilterCondition.NotEmpty,
};

/** Fecha corta en el idioma de la app: «19 nov 2026» en español, «19 Nov 2026» en inglés. */
export const formatDate = (seconds: number): string => {
	if (!(Number(seconds) > 0)) {
		return '';
	};

	const lang = /^es/i.test(String(S.Common.interfaceLang || '')) ? 'es' : 'en-GB';

	return new Date(Number(seconds) * 1000).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
};

export const escapeHtml = (s: string): string => {
	return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
};

const formatValue = (key: string, value: any, subId: string): string => {
	if ((value === null) || (value === undefined)) {
		return '';
	};

	const relation = S.Record.getRelationByKey(key);
	const format = relation?.format;

	// Opciones (select, multi_select, tags): su nombre, no su id
	if ([ I.RelationType.Select, I.RelationType.MultiSelect ].includes(format)) {
		return Relation.getOptions(value).map(it => it.name).filter(it => it).join(', ');
	};

	// Propiedades que apuntan a objetos: el nombre de cada objeto
	if (format == I.RelationType.Object) {
		return Relation.getArrayValue(value).map(id => S.Detail.get(subId, id, [ 'name' ], true)).filter(it => !it._empty_).map(it => U.Object.name(it)).join(', ');
	};

	if (typeof value == 'boolean') {
		return value ? '✓' : '';
	};

	// Fechas: segundos desde 1970
	if ((format == I.RelationType.Date) || ((typeof value == 'number') && /date$/i.test(key))) {
		return formatDate(Number(value));
	};

	if (Array.isArray(value)) {
		return value.map(it => formatValue(key, it, subId)).filter(it => it).join(', ');
	};

	return String(value);
};

export const renderItem = (template: string, record: any, spaceId: string, subId: string, apiKeys?: Map<string, string>): string => {
	const url = `anytype://object?objectId=${record.id}&spaceId=${spaceId}`;

	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match: string, key: string) => {
		switch (key) {
			case 'url': return escapeHtml(url);
			case 'icon': return escapeHtml(record.iconEmoji || '');
			case 'name': return escapeHtml(U.Object.name(record));
		};

		const k = resolveKey(key, apiKeys);
		return escapeHtml(formatValue(k, record[k], subId));
	});
};
