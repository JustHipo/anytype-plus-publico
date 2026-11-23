// plus: alto de un bloque HTML, compartido por el modo nativo y el aislado.
// Por defecto el alto sigue al contenido. Arrastrando la manija de abajo se fija un alto sin límite, guardado
// en `fields.plusHeight` (se sincroniza; el Anytype oficial lo ignora), y el contenido que no cabe queda con
// scroll. Doble clic en la manija, o el botón «Alto automático», vuelve al alto del contenido.

import React, { useRef, useState } from 'react';
import * as I from 'Interface';
import { t } from './text';

export const MIN_HEIGHT = 40;
const DOUBLE_CLICK_MS = 400;

export const getFixedHeight = (block: I.Block): number => {
	return Math.max(0, Number(block?.fields?.plusHeight) || 0);
};

export const setFixedHeight = (rootId: string, block: I.Block, height: number) => {
	C.BlockListSetFields(rootId, [ { blockId: block.id, fields: { ...(block.fields || {}), plusHeight: height } } ]);
};

/** Vuelve al alto automático (borra el alto fijo guardado en el bloque). */
export const resetHtmlLiveHeight = (rootId: string, block: I.Block) => {
	setFixedHeight(rootId, block, 0);
};

/**
 * @param getCurrent alto que tiene ahora el contenido en pantalla, para empezar a arrastrar desde ahí
 */
export const usePlusHeight = (rootId: string, block: I.Block, readonly: boolean, getCurrent: () => number) => {
	const fixed = getFixedHeight(block);
	const [ drag, setDrag ] = useState(0);
	const lastDownRef = useRef(0);

	const onMouseDown = (e: React.MouseEvent) => {
		if (readonly) {
			return;
		};

		e.preventDefault();
		e.stopPropagation();

		// Doble clic detectado a mano: el evento dblclick del navegador no siempre llega a la manija
		const now = Date.now();
		if (now - lastDownRef.current < DOUBLE_CLICK_MS) {
			lastDownRef.current = 0;
			if (fixed) {
				resetHtmlLiveHeight(rootId, block);
			};
			return;
		};
		lastDownRef.current = now;

		const startY = e.clientY;
		const startH = Math.max(MIN_HEIGHT, Math.round(getCurrent()));
		let last = startH;

		const onMove = (ev: MouseEvent) => {
			last = Math.max(MIN_HEIGHT, Math.round(startH + ev.clientY - startY));
			setDrag(last);
		};

		const onUp = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			setDrag(0);

			if (last != startH) {
				setFixedHeight(rootId, block, last);
			};
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	};

	const handle = !readonly ? (
		<div
			className="plusResize"
			title={fixed ? t('resizeFixed') : t('resizeAuto')}
			onMouseDown={onMouseDown}
		/>
	) : null;

	return { fixed, drag, isFixed: fixed > 0, isDragging: drag > 0, handle };
};
