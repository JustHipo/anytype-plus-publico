// plus: estilos de bloque (tarjeta). Se guardan en `fields.plusStyle` del bloque: heart los conserva y el Anytype
// oficial los ignora. Un bloque con hijos (por ejemplo un título con texto sangrado debajo) los envuelve a todos,
// así una sección completa se ve como tarjeta.

import * as I from 'Interface';
import { t } from './text';

export const PLUS_BLOCK_STYLES = [ '', 'card', 'accent' ];
export const PLUS_STYLE_ITEM_ID = 'plusBlockStyle';

export const blockStyleClass = (block: I.Block): string => {
	const v = String(block?.fields?.plusStyle || '');
	return (v && PLUS_BLOCK_STYLES.includes(v)) ? U.String.toCamelCase(`plus-style-${v}`) : '';
};

export const blockStyleOptions = (): I.Option[] => [
	{ id: '', name: t('styleNone') },
	{ id: 'card', name: t('styleCard') },
	{ id: 'accent', name: t('styleAccent') },
];

export const getBlockStyleItem = (block: I.Block): any => {
	const value = String(block?.fields?.plusStyle || '');
	const option = blockStyleOptions().find(it => it.id == value);

	return { id: PLUS_STYLE_ITEM_ID, iconParam: { name: 'aplus/blockFrame' }, name: t('blockStyle'), caption: value ? option?.name : '', arrow: true };
};

/** Datos del submenú `select`: aplica el estilo a todos los bloques elegidos, sin perder sus otros `fields`. */
export const getBlockStyleMenuData = (rootId: string, blockIds: string[], value: string, onDone: () => void): any => ({
	value,
	// Check explícito: el submenú no marca la opción de id vacío («Ninguno»)
	options: blockStyleOptions().map(it => ({ ...it, checkbox: it.id == value })),
	onSelect: (e: any, option: any) => {
		const list = blockIds.map(id => S.Block.getLeaf(rootId, id)).filter(it => it).map(it => ({
			blockId: it.id,
			fields: { ...(it.fields || {}), plusStyle: option.id },
		}));

		if (list.length) {
			C.BlockListSetFields(rootId, list);
		};
		onDone();
	},
});

// «Mostrar completo» en un bloque de enlace: `fields.plusEmbed` hace que el objeto enlazado se vea entero
// (src/ts/plus/embedObject.tsx). El Anytype oficial lo sigue mostrando como enlace.

export const PLUS_EMBED_ITEM_ID = 'plusEmbedToggle';

export const getEmbedToggleItem = (block: I.Block): any => ({
	id: PLUS_EMBED_ITEM_ID,
	name: block?.fields?.plusEmbed ? t('embedAsLink') : t('embedFull'),
});

export const toggleEmbed = (rootId: string, blockIds: string[]) => {
	const blocks = blockIds.map(id => S.Block.getLeaf(rootId, id)).filter(it => it && it.isLink());
	if (!blocks.length) {
		return;
	};

	const value = !blocks[0].fields?.plusEmbed;

	C.BlockListSetFields(rootId, blocks.map(it => ({ blockId: it.id, fields: { ...(it.fields || {}), plusEmbed: value } })));
};
