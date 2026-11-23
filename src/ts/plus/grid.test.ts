import { describe, it, expect } from 'vitest';
import { snapToGrid, pairFromPointer } from './grid';

describe('snapToGrid', () => {
	it('encaja el borde en el doceavo más cercano de la fila', () => {
		// Dos columnas de media fila; el borde al 40 % del par = 0,4 de la fila → 5/12
		expect(snapToGrid(0, 1, 0.4)).toBeCloseTo(5 / 12);
	});

	it('usa la posición en la fila completa, no en el par', () => {
		// Tres columnas de un tercio; el par 2-3 empieza en 1/3. Borde al 50 % del par = 2/3 de la fila → 8/12
		expect(snapToGrid(1 / 3, 2 / 3, 0.5) * (2 / 3) + 1 / 3).toBeCloseTo(8 / 12);
		// Borde al 30 % del par = 0,533 de la fila → 6/12
		expect(snapToGrid(1 / 3, 2 / 3, 0.3) * (2 / 3) + 1 / 3).toBeCloseTo(6 / 12);
	});

	it('ninguna columna queda más angosta que un doceavo', () => {
		expect(snapToGrid(0, 1, 0.01)).toBeCloseTo(1 / 12);
		expect(snapToGrid(0, 1, 0.99)).toBeCloseTo(11 / 12);
	});

	it('un par demasiado angosto no se toca', () => {
		expect(snapToGrid(0.9, 0.1, 0.3)).toBe(0.3);
	});
});

describe('pairFromPointer', () => {
	it('mide contra la fila en pantalla', () => {
		// Fila de 1200px desde x=100; puntero a 1/3 de la fila; par completo
		expect(pairFromPointer(500, { left: 100, width: 1200 }, 0, 1)).toBeCloseTo(1 / 3);
		// Par 2-3 de tres columnas iguales: puntero en 2/3 de la fila = mitad del par
		expect(pairFromPointer(900, { left: 100, width: 1200 }, 1 / 3, 2 / 3)).toBeCloseTo(0.5);
	});
});
