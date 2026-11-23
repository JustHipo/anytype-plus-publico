import { describe, it, expect, vi } from 'vitest';

vi.mock('Interface', () => ({ FilterCondition: {}, ObjectLayout: {} }));

import { hasPageMark } from './htmlPage';

describe('hasPageMark', () => {
	it('reconoce el comentario', () => {
		expect(hasPageMark('<!-- plus:pagina -->\n<div>hola</div>')).toBe(true);
		expect(hasPageMark('<!--plus:pagina-->')).toBe(true);
	});

	it('reconoce el meta en cualquier orden', () => {
		expect(hasPageMark('<meta name="plus" content="pagina">')).toBe(true);
		expect(hasPageMark('<meta content=\'pagina\' name=\'plus\' />')).toBe(true);
	});

	it('no confunde otras cosas', () => {
		expect(hasPageMark('<div>plus:pagina</div>')).toBe(false);
		expect(hasPageMark('<meta name="plus" content="otra">')).toBe(false);
		expect(hasPageMark('')).toBe(false);
		expect(hasPageMark(undefined)).toBe(false);
	});
});
