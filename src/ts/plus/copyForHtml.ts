// plus: «Copiar para HTML». Copia la etiqueta que muestra un objeto dentro de un HTML, para pegarla en el
// código o dársela a Claude sin buscar ids. Un set, una colección o un tipo se copian como vista nativa;
// cualquier otro objeto, como objeto vivo.

import { t } from './text';

export const PLUS_COPY_ITEM_ID = 'plusCopyHtml';

export const getCopyForHtmlItem = () => {
	return { id: PLUS_COPY_ITEM_ID, iconParam: { name: 'menu/action/embed' }, name: t('copyForHtml') };
};

export const getHtmlTag = (object: any): string => {
	if (!object || !object.id) {
		return '';
	};

	const name = String(object.name || '').replace(/--/g, '- -');
	const isView = U.Object.isInSetLayouts(object.layout);

	return isView
		? `<!-- ${name} -->\n<anytype-view object="${object.id}"></anytype-view>`
		: `<anytype-object object="${object.id}"></anytype-object><!-- ${name} -->`;
};

export const copyForHtml = (object: any) => {
	const tag = getHtmlTag(object);

	if (tag) {
		U.Common.copyToast(t('copyForHtml'), tag, t('copiedForHtml'));
	};
};
