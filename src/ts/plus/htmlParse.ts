// plus: preparación del HTML para el modo nativo.
// En modo nativo el HTML se dibuja dentro de la propia página de Anytype (shadow DOM), sin iframe, para que
// las piezas nativas (<anytype-view>, <anytype-object>…) sean componentes reales de Anytype en el flujo.
// Por eso aquí NUNCA puede pasar código ejecutable: ni <script>, ni atributos on*, ni javascript:, ni
// formularios o marcos que naveguen la ventana. Un HTML con scripts se dibuja aparte, en el iframe aislado.

import DOMPurify from 'dompurify';

export const PLUS_TAGS = [ 'anytype-view', 'anytype-object', 'anytype-prop', 'anytype-list', 'anytype-folders', 'anytype-file', 'anytype-changes' ];

// Etiquetas que se llenan con HTML dentro del shadow DOM (no son slots): la lista y el árbol de carpetas
export const PLUS_FILL_TAGS = [ 'anytype-list', 'anytype-folders', 'anytype-changes' ];

const PLUS_ATTRS = [ 'object', 'view', 'key', 'as', 'source', 'limit', 'sort', 'where', 'filter', 'height', 'readonly', 'root', 'open', 'hint', 'space' ];

// Atributos que puede llevar una etiqueta <anytype-*>: los suyos y los comunes. Lista explícita: un nombre cualquiera
// (por ejemplo onmouseover) no pasa aunque DOMPurify acepte la etiqueta como elemento propio.
const PLUS_ATTR_CHECK = new RegExp(`^(?:${PLUS_ATTRS.join('|')}|class|id|title|style|slot|data-[a-z0-9-]+)$`);

const FORBID_TAGS = [
	'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'base', 'meta', 'link', 'noscript',
];

const URI_REGEXP = /^(?:(?:https?|mailto|tel|anytype):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export interface PlusSlot {
	name: string;
	tag: string;
	attrs: Record<string, string>;
	inner: string;
};

export interface PlusList {
	name: string;
	tag: string;
	attrs: Record<string, string>;
	template: string;
};

export interface PlusParsed {
	html: string;
	css: string[];
	slots: PlusSlot[];
	lists: PlusList[];
	bodyClass: string;
	bodyStyle: string;
};

/**
 * ¿El HTML trae código ejecutable? Si es así no se dibuja en modo nativo sino en el iframe aislado.
 */
export const hasExecutableCode = (html: string): boolean => {
	const s = String(html || '');

	return /<script[\s>/]/i.test(s)
		|| /<[a-z][^>]*\son[a-z]+\s*=/i.test(s)
		|| /(?:href|src|action)\s*=\s*["']?\s*javascript:/i.test(s);
};

/**
 * Separa estilos, limpia el marcado y cambia cada etiqueta <anytype-*> por un <slot> con nombre,
 * donde la app proyecta el componente nativo.
 */
export const parseHtml = (source: string): PlusParsed => {
	const doc = new DOMParser().parseFromString(String(source || ''), 'text/html');
	const css: string[] = [];

	doc.querySelectorAll('style').forEach(el => {
		css.push(el.textContent || '');
		el.remove();
	});

	const bodyClass = doc.body.getAttribute('class') || '';
	const bodyStyle = doc.body.getAttribute('style') || '';

	const clean = DOMPurify.sanitize(doc.body.innerHTML, {
		ADD_TAGS: PLUS_TAGS,
		ADD_ATTR: PLUS_ATTRS,
		FORBID_TAGS,
		FORBID_ATTR: [ 'srcdoc', 'formaction', 'ping' ],
		ALLOWED_URI_REGEXP: URI_REGEXP,
		ALLOW_UNKNOWN_PROTOCOLS: false,
		CUSTOM_ELEMENT_HANDLING: {
			tagNameCheck: /^anytype-[a-z]+$/,
			attributeNameCheck: PLUS_ATTR_CHECK,
			allowCustomizedBuiltInElements: false,
		},
	}).toString();

	const holder = document.createElement('template');
	holder.innerHTML = clean;

	// <anytype-list>: su contenido es la plantilla de cada elemento. Se queda en el HTML (no es un slot),
	// porque el resultado lo estiliza el CSS del autor.
	const lists: PlusList[] = [];

	holder.content.querySelectorAll(PLUS_FILL_TAGS.join(',')).forEach((el, i) => {
		const name = `plus-list-${i}`;
		const attrs: Record<string, string> = {};

		for (const attr of Array.from(el.attributes)) {
			attrs[attr.name] = attr.value;
		};

		lists.push({ name, tag: el.tagName.toLowerCase(), attrs, template: el.innerHTML });

		el.innerHTML = '';
		el.setAttribute('data-plus-list', name);
	});

	const slotTags = PLUS_TAGS.filter(it => !PLUS_FILL_TAGS.includes(it)).join(',');
	const slots: PlusSlot[] = [];

	holder.content.querySelectorAll(slotTags).forEach((el, i) => {
		// Una etiqueta nativa dentro de otra no se proyecta: la de afuera manda
		if (el.parentElement?.closest(slotTags)) {
			return;
		};

		const name = `plus-${i}`;
		const attrs: Record<string, string> = {};

		for (const attr of Array.from(el.attributes)) {
			attrs[attr.name] = attr.value;
		};

		slots.push({ name, tag: el.tagName.toLowerCase(), attrs, inner: el.innerHTML });

		const slot = document.createElement('slot');
		slot.setAttribute('name', name);

		el.innerHTML = '';
		el.appendChild(slot);
	});

	return { html: holder.innerHTML, css, slots, lists, bodyClass, bodyStyle };
};

/**
 * Reescribe los selectores que apuntan al documento para que apunten al contenedor del bloque:
 * `html` y `:root` pasan a `:host` (ahí viven las variables CSS) y `body` pasa a `.plus-body`,
 * el envoltorio que recibe la clase y el estilo del <body> original.
 */
export const scopeSelector = (selector: string): string => {
	return String(selector || '')
		.replace(/(^|[\s>+~,(])body(?![\w-])/gi, '$1.plus-body')
		.replace(/(^|[\s>+~,(])(?:html|:root)(?![\w-])/gi, '$1:host')
		.replace(/:host((?:[.#[:][^\s>+~,)]+)+)/g, ':host($1)');
};
