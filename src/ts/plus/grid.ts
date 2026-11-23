// plus: columnas que encajan en una grilla de 12.
// En una fila de columnas, el ancho de cada columna es una fracción de la fila (`fields.width`). Al arrastrar el
// borde entre dos columnas, Anytype solo encaja en 25/50/75 % del par. Aquí el borde siempre cae en un doceavo de
// la fila completa, y ninguna columna queda más angosta que un doceavo.

export const PLUS_GRID = 12;

/**
 * @param before Ancho (fracción de la fila) de las columnas a la izquierda del par que se ajusta
 * @param sum Ancho del par (la columna izquierda más la derecha)
 * @param percent Dónde quedó el borde, como fracción del par (0 a 1)
 * @returns La fracción del par que ocupa la columna izquierda, ya encajada en la grilla
 */
export const snapToGrid = (before: number, sum: number, percent: number, grid = PLUS_GRID): number => {
	const step = 1 / grid;
	const min = before + step;
	const max = before + sum - step;

	// Un par más angosto que dos doceavos no se puede encajar: se deja como está
	if ((sum <= 0) || (max < min)) {
		return percent;
	};

	let edge = Math.round((before + percent * sum) * grid) / grid;
	edge = Math.min(max, Math.max(min, edge));

	return (edge - before) / sum;
};

/**
 * Posición del puntero → fracción del par (0 a 1), medida contra la fila real en pantalla.
 * @param pageX Posición horizontal del puntero
 * @param row Rectángulo de la fila (el contenedor de las columnas)
 */
export const pairFromPointer = (pageX: number, row: { left: number; width: number }, before: number, sum: number): number => {
	if (!row.width || (sum <= 0)) {
		return 0.5;
	};

	return ((pageX - row.left) / row.width - before) / sum;
};
