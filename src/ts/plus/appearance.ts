// plus: apariencia de Anytype Plus.
// - Paleta (Anytype o Solarized) y tamaño de texto general: preferencias de cada persona, guardadas en la app.
// - Fuente y tamaño de una página: se guardan en el bloque raíz del objeto (`fields.plusFont`,
//   `fields.plusFontSize`), así que se sincronizan y todos ven la página igual. El Anytype oficial los ignora.

import { useEffect } from 'react';
import { autorun } from 'mobx';
import * as I from 'Interface';
import Storage from 'Lib/storage';
import { t } from './text';

export const PALETTES = [ '', 'solarized' ];
export const TEXT_SCALES = [ 0.9, 1, 1.1, 1.2, 1.35 ];
export const PAGE_FONTS = [ '', 'sans', 'serif', 'mono' ];

export const getPalette = (): string => {
	const v = String(Storage.get('plusPalette') || '');
	return PALETTES.includes(v) ? v : '';
};

export const getTextScale = (): number => {
	const v = Number(Storage.get('plusTextScale')) || 1;
	return TEXT_SCALES.includes(v) ? v : 1;
};

/** Aplica paleta y tamaño de texto general al documento. Se llama al cambiar el tema y al cambiar estas opciones. */
export const applyAppearance = () => {
	U.Dom.addBodyClass('plusPalette', getPalette());
	document.documentElement.style.setProperty('--plus-text-scale', String(getTextScale()));
};

export const setPalette = (v: string) => {
	Storage.set('plusPalette', PALETTES.includes(v) ? v : '');
	applyAppearance();
};

export const setTextScale = (v: number) => {
	Storage.set('plusTextScale', TEXT_SCALES.includes(v) ? v : 1);
	applyAppearance();
};

export const paletteOptions = (): I.Option[] => [
	{ id: '', name: 'Anytype' },
	{ id: 'solarized', name: 'Solarized' },
];

export const scaleOptions = (withDefault?: boolean): I.Option[] => {
	const list: I.Option[] = TEXT_SCALES.map(v => ({ id: String(v), name: `${Math.round(v * 100)}%` }));
	return withDefault ? [ { id: '', name: t('pageDefault') } ].concat(list) : list;
};

export const fontOptions = (): I.Option[] => [
	{ id: '', name: t('pageDefault') },
	{ id: 'sans', name: 'Sans (Inter)' },
	{ id: 'serif', name: 'Serif' },
	{ id: 'mono', name: 'Mono (Plex)' },
];

/** Fuente y tamaño de una página, desde el bloque raíz. */
export const getPageStyle = (rootId: string): { font: string; scale: number } => {
	const fields = S.Block.getLeaf(rootId, rootId)?.fields || {};
	const font = PAGE_FONTS.includes(fields.plusFont) ? fields.plusFont : '';
	const scale = TEXT_SCALES.includes(Number(fields.plusFontSize)) ? Number(fields.plusFontSize) : 1;

	return { font, scale };
};

export const setPageField = (rootId: string, key: 'plusFont' | 'plusFontSize', value: any) => {
	const root = S.Block.getLeaf(rootId, rootId);
	if (!root) {
		return;
	};

	C.BlockListSetFields(rootId, [ { blockId: rootId, fields: { ...(root.fields || {}), [key]: value } } ]);
};

/**
 * Aplica al contenedor del editor la fuente y el tamaño de la página, y los vuelve a aplicar cuando cambian
 * (los `fields` del bloque raíz son observables; el editor no es `observer`, por eso va con `autorun`).
 */
export const usePlusPageStyle = (rootId: string, nodeRef: React.RefObject<HTMLElement>) => {
	// El mapa de bloques no es observable: si el editor se monta antes de que cargue la página, el `autorun` no
	// vería llegar el bloque raíz. Por eso el efecto se rehace cuando el raíz aparece o cambia.
	const root = S.Block.getLeaf(rootId, rootId);

	useEffect(() => {
		return autorun(() => {
			const { font, scale } = getPageStyle(rootId);
			const node = nodeRef.current;

			if (!node) {
				return;
			};

			// Atributo y no clase: el encabezado del editor reescribe la clase completa de este contenedor
			if (font) {
				node.setAttribute('data-plus-font', font);
			} else {
				node.removeAttribute('data-plus-font');
			};

			node.style.setProperty('--plus-page-scale', String(scale));
		});
	}, [ rootId, root ]);
};

// Entradas del menú del objeto («Fuente de la página», «Tamaño del texto de la página»).

export const PLUS_PAGE_FONT_ID = 'plusPageFont';
export const PLUS_PAGE_SIZE_ID = 'plusPageSize';

export const isPageStyleItem = (id: string): boolean => [ PLUS_PAGE_FONT_ID, PLUS_PAGE_SIZE_ID ].includes(id);

export const getPageStyleItems = (): any[] => [
	{ id: PLUS_PAGE_FONT_ID, iconParam: { name: 'aplus/pageFont' }, name: t('pageFont'), arrow: true },
	{ id: PLUS_PAGE_SIZE_ID, iconParam: { name: 'aplus/pageTextSize' }, name: t('pageTextSize'), arrow: true },
];

/** Datos del submenú `select` para una de las entradas anteriores. */
export const getPageStyleMenuData = (rootId: string, id: string, onDone: () => void): any => {
	const { font, scale } = getPageStyle(rootId);
	const isFont = (id == PLUS_PAGE_FONT_ID);

	const value = isFont ? font : ((scale == 1) ? '' : String(scale));
	const options = isFont ? fontOptions() : scaleOptions(true).filter(it => it.id != '1');

	return {
		value,
		// Check explícito: el submenú no marca la opción de id vacío («Predeterminado»)
		options: options.map(it => ({ ...it, checkbox: it.id == value })),
		onSelect: (e: any, option: any) => {
			if (isFont) {
				setPageField(rootId, 'plusFont', option.id);
			} else {
				setPageField(rootId, 'plusFontSize', option.id ? Number(option.id) : '');
			};
			onDone();
		},
	};
};
