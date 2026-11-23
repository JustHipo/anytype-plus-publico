import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('Lib/storage', () => ({ default: { get: () => ({}), set: () => {} } }));
vi.mock('Interface', () => ({ ToastAction: { None: 0 }, FilterCondition: {}, SortType: {} }));

const sprintf = (f: string, ...a: any[]) => { let i = 0; return f.replace(/%s/g, () => String(a[i++])); };
const toasts: string[] = [];
const sent: any[] = [];
let focused = true;

beforeEach(() => {
	vi.useFakeTimers();
	toasts.length = 0;
	sent.length = 0;
	vi.stubGlobal('window', { setTimeout: (fn: any, ms: number) => setTimeout(fn, ms) });
	vi.stubGlobal('S', { Common: { get windowIsFocused () { return focused; }, interfaceLang: 'es' } });
	vi.stubGlobal('U', { String: { sprintf }, Space: { getSpaceviewBySpaceId: () => ({ name: 'Equipo' }) }, Router: { go: () => {} } });
	vi.stubGlobal('Preview', { toastShow: (p: any) => toasts.push(p.text) });
	vi.stubGlobal('Renderer', { send: (type: string, p: any) => sent.push({ type, ...p }) });
});

afterEach(() => vi.useRealTimers());

const change = (id: string, who = 'Ana', name = `Página ${id}`) => ({ id, spaceId: 'sp', name, typeId: 't', typeName: 'Página HTML', who, whoId: who, layout: 0, date: 1 });

describe('avisos de cambios agrupados', () => {
	it('un solo cambio: aviso con su nombre, después de la espera', async () => {
		const { queueChange } = await import('./changeAlerts');
		queueChange(change('a'));
		expect(toasts).toEqual([]);
		vi.advanceTimersByTime(15000);
		expect(toasts).toEqual([ '«Página a» cambió · Ana · Página HTML · Equipo' ]);
	});

	it('varios cambios de la misma persona: un solo aviso', async () => {
		const { queueChange } = await import('./changeAlerts');
		[ 'a', 'b', 'c', 'd', 'e', 'f', 'g' ].forEach(id => queueChange(change(id)));
		queueChange(change('z', 'Beto'));
		vi.advanceTimersByTime(15000);
		expect(toasts).toHaveLength(2);
		expect(toasts[0]).toBe('Ana cambió 7 objetos · Página g, Página f, Página e · Equipo');
		expect(toasts[1]).toContain('«Página z» cambió · Beto');
	});

	it('sin foco: aviso del sistema que abre el objeto o la lista', async () => {
		const { queueChange } = await import('./changeAlerts');
		focused = false;
		queueChange(change('a', 'Ana'));
		queueChange(change('b', 'Beto'));
		queueChange(change('c', 'Beto'));
		vi.advanceTimersByTime(15000);
		focused = true;
		expect(sent.map(it => it.type)).toEqual([ 'notification', 'notification' ]);
		expect(sent.map(it => it.title)).toEqual([ '«Página a» cambió', 'Beto cambió 2 objetos' ]);
		expect(sent.map(it => it.cmd)).toEqual([ 'plusOpenObject', 'plusOpenRecent' ]);
	});
});
