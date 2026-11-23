// plus: visor de archivos DOCX dentro de Anytype, con docx-preview (dibuja páginas, fuentes, tablas e imágenes
// como en Word). El archivo se lee del servidor local de archivos de Anytype; nada sale a internet.
// Todo se dibuja dentro de un shadow DOM: los estilos del documento no tocan los de la app.
// Solo lectura: editar DOCX queda para después.

import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader } from 'Component';
import { t } from './text';

interface Props {
	fileId: string;
};

const DOCX_EXT = [ 'docx', 'docm', 'dotx' ];
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml';

/** ¿Este objeto archivo es un documento de Word que el visor puede abrir? */
export const isDocxObject = (object: any): boolean => {
	const ext = String(object?.fileExt || '').toLowerCase().replace(/^\./, '');
	const mime = String(object?.fileMimeType || '').toLowerCase();

	return DOCX_EXT.includes(ext) || mime.startsWith(DOCX_MIME);
};

// Viñetas de Word que usan caracteres privados de la fuente Symbol/Wingdings (sin esa fuente se ven como □)
const SYMBOL_MAP: [ RegExp, string ][] = [
	[ /\uF0B7|\\f0b7/gi, '•' ],
	[ /\uF0A7|\\f0a7/gi, '▪' ],
	[ /\uF0D8|\\f0d8/gi, '➢' ],
	[ /\uF076|\\f076/gi, '❖' ],
	[ /\uF0FC|\\f0fc/gi, '✓' ],
	[ /\uF0A8|\\f0a8/gi, '◦' ],
];

export const fixSymbols = (text: string): string => SYMBOL_MAP.reduce((acc, [ re, to ]) => acc.replace(re, to), String(text || ''));

const fixDocumentSymbols = (root: ShadowRoot) => {
	root.querySelectorAll('style').forEach(style => {
		const fixed = fixSymbols(style.textContent);
		if (fixed != style.textContent) {
			style.textContent = fixed;
		};
	});

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();

	while (node) {
		if (/[\uF000-\uF0FF]/.test(node.nodeValue)) {
			node.nodeValue = fixSymbols(node.nodeValue);
		};
		node = walker.nextNode();
	};
};

const PAGE_GAP = 32;

const SHADOW_CSS = `
:host { display: block; }
.plus-docx-message { padding: 24px; color: var(--color-text-secondary); font-family: 'Inter', sans-serif; }
.docx-wrapper { background: transparent !important; padding: 24px 0px !important; }
.docx-wrapper > section.docx { box-shadow: 0px 2px 12px rgba(0, 0, 0, 0.15) !important; margin-bottom: 24px !important; }
`;

const PlusDocxViewer = (props: Props) => {

	const { fileId } = props;
	const hostRef = useRef<HTMLDivElement>(null);
	const [ state, setState ] = useState<'loading' | 'ready' | 'error'>('loading');

	useEffect(() => {
		const host = hostRef.current;
		if (!host || !fileId) {
			return;
		};

		const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
		const styles = document.createElement('div');
		const body = document.createElement('div');
		const base = document.createElement('style');

		base.textContent = SHADOW_CSS;
		shadow.replaceChildren(base, styles, body);

		// Los enlaces del documento los abre Anytype (la web en el navegador); nunca navegan dentro de la app
		const onClick = (e: Event) => {
			const link = e.composedPath().find((el: any) => el?.tagName == 'A') as HTMLAnchorElement;
			if (!link) {
				return;
			};

			e.preventDefault();

			const href = String(link.getAttribute('href') || '');
			if (/^https?:\/\//i.test(href)) {
				Action.openUrl(href);
			} else
			if (href.startsWith('#')) {
				shadow.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
			};
		};

		shadow.addEventListener('click', onClick);

		// La página de Word (816px en carta) se achica para caber en el panel; nunca se agranda
		const fit = () => {
			const wrapper = shadow.querySelector('.docx-wrapper') as HTMLElement;
			const page = shadow.querySelector('section.docx') as HTMLElement;

			if (!wrapper || !page) {
				return;
			};

			wrapper.style.zoom = '1';

			const available = host.clientWidth - PAGE_GAP;
			const width = page.offsetWidth;

			wrapper.style.zoom = String((width > available) && (available > 0) ? available / width : 1);
		};

		const observer = new ResizeObserver(() => fit());
		observer.observe(host);

		let cancelled = false;

		setState('loading');

		fetch(S.Common.fileUrl(fileId))
			.then(res => {
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				};
				return res.arrayBuffer();
			})
			.then(buffer => {
				if (cancelled) {
					return;
				};

				return renderAsync(buffer, body, styles, {
					inWrapper: true,
					breakPages: true,
					useBase64URL: true,
					renderHeaders: true,
					renderFooters: true,
					renderFootnotes: true,
					renderEndnotes: true,
					renderComments: false,
					renderChanges: false,
					// Fragmentos HTML incrustados en el DOCX: no se dibujan (podrían traer código)
					renderAltChunks: false,
					experimental: false,
				});
			})
			.then(() => {
				if (cancelled) {
					return;
				};

				fixDocumentSymbols(shadow);
				fit();
				setState('ready');
			})
			.catch(e => {
				console.error('[Plus] DOCX', e);

				if (!cancelled) {
					setState('error');
				};
			});

		return () => {
			cancelled = true;
			observer.disconnect();
			shadow.removeEventListener('click', onClick);
		};
	}, [ fileId ]);

	return (
		<div className="plusDocx">
			{(state == 'loading') ? <Loader /> : ''}
			{(state == 'error') ? <div className="plusDocxMessage">{t('docxError')}</div> : ''}
			<div ref={hostRef} className="plusDocxHost" />
		</div>
	);

};

export default PlusDocxViewer;
