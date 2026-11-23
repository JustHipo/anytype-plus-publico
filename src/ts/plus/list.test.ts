import { describe, it, expect, beforeAll, vi } from 'vitest';

// Relaciones simuladas: claves internas de Anytype
const RELATIONS: Record<string, any> = {
	name: { format: 0 },
	createdDate: { format: 4 },
	estado: { format: 3 },
	tag: { format: 11 },
	modulos: { format: 100 },
	'6affaa11': { format: 3 },
	done: { format: 6 },
};
const OPTIONS: Record<string, any> = { opt1: { name: 'Vigente' }, opt2: { name: 'Borrador' }, t1: { name: 'web' }, t2: { name: 'api' }, j1: { name: 'Ana' } };
const OBJECTS: Record<string, any> = { m1: { name: 'Mapa' }, m2: { name: 'Turnos' } };

beforeAll(() => {
	vi.stubGlobal('S', {
		Record: { getRelationByKey: (k: string) => RELATIONS[k] || null },
		Detail: { get: (subId: string, id: string) => OBJECTS[id] ? { ...OBJECTS[id], _empty_: false } : { _empty_: true } },
		Common: { space: 'space1', interfaceLang: 'es' },
	});
	vi.stubGlobal('Relation', {
		getOptions: (v: any) => [].concat(v || []).map((id: string) => OPTIONS[id]).filter(Boolean),
		getArrayValue: (v: any) => [].concat(v || []),
	});
	vi.stubGlobal('U', { Object: { name: (o: any) => o.name } });
});

describe('plus/list', () => {

	it('acepta la clave de la API o la interna', async () => {
		const { resolveKey } = await import('./listRender');

		expect(resolveKey('created_date')).toBe('createdDate');
		expect(resolveKey('createdDate')).toBe('createdDate');
		expect(resolveKey('name')).toBe('name');
		expect(resolveKey('no_existe')).toBe('no_existe');
	});

	it('muestra nombres de opciones y de objetos, no ids', async () => {
		const { renderItem } = await import('./listRender');
		const record = { id: 'r1', name: 'Decisión <1>', estado: 'opt1', tag: [ 't1', 't2' ], modulos: [ 'm1', 'm2' ], done: true, createdDate: 0 };
		const html = renderItem('{{name}}|{{estado}}|{{tag}}|{{modulos}}|{{done}}|{{created_date}}|{{url}}', record, 'space1', 'sub1');
		const [ name, estado, tag, modulos, done, created, url ] = html.split('|');

		expect(name).toBe('Decisión &lt;1&gt;');
		expect(estado).toBe('Vigente');
		expect(tag).toBe('web, api');
		expect(modulos).toBe('Mapa, Turnos');
		expect(done).toBe('✓');
		expect(created).toBe('');
		expect(url).toBe('anytype://object?objectId=r1&amp;spaceId=space1');
	});


	it('traduce las claves de la API de las propiedades del espacio', async () => {
		const { resolveKey, renderItem } = await import('./listRender');
		const api = new Map([ [ 'origen', '6affaa11' ] ]);

		expect(resolveKey('origen', api)).toBe('6affaa11');
		expect(resolveKey('origen')).toBe('origen');
		expect(renderItem('{{origen}}', { id: 'r', '6affaa11': 'j1' }, 's', 'sub', api)).toBe('Ana');
	});

	it('muestra fechas cortas en el idioma de la app', async () => {
		const { formatDate } = await import('./listRender');
		const s = Date.UTC(2026, 10, 19, 12) / 1000;

		expect(formatDate(s)).toMatch(/^19 nov 2026$/i);
		expect(formatDate(0)).toBe('');
	});

	it('lee la gramática de filtros de la API', async () => {
		const { parseFilter } = await import('./listRender');

		expect(parseFilter('estado_decision IN ("Vigente", "Propuesta")')).toEqual([ { key: 'estado_decision', op: 'IN', values: [ 'Vigente', 'Propuesta' ] } ]);
		expect(parseFilter('name CONTAINS "DE-"')).toEqual([ { key: 'name', op: 'CONTAINS', values: [ 'DE-' ] } ]);
		expect(parseFilter('name NOT CONTAINS "x" AND done = false AND prioridad >= 2')).toEqual([
			{ key: 'name', op: 'NOT CONTAINS', values: [ 'x' ] },
			{ key: 'done', op: '=', values: [ false ] },
			{ key: 'prioridad', op: '>=', values: [ 2 ] },
		]);
		expect(parseFilter('description IS EMPTY and tag NOT IN ("a b", "c, d")')).toEqual([
			{ key: 'description', op: 'EMPTY', values: [] },
			{ key: 'tag', op: 'NOT IN', values: [ 'a b', 'c, d' ] },
		]);
		expect(parseFilter('name = "Plan AND acta"')).toEqual([ { key: 'name', op: '=', values: [ 'Plan AND acta' ] } ]);
		expect(parseFilter('texto sin operador')).toEqual([]);
	});

});
