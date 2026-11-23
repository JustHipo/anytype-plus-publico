// plus: HTML en modo nativo.
// El HTML (ya limpio, sin código ejecutable) se dibuja dentro de la página de Anytype en un shadow DOM:
// sin iframe, con el alto natural del contenido, con el scroll, la selección y el tema de la app.
// Cada etiqueta <anytype-*> es un <slot>, y ahí se proyecta un componente real de Anytype (vista, objeto…),
// que vive en el DOM normal y por eso conserva los estilos y el comportamiento nativos.

import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as I from 'Interface';
import { parseHtml, scopeSelector, PlusSlot, PlusList } from './htmlParse';
import PlusListFiller from './list';
import PlusChangesFiller from './changesList';
import PlusNativeSlot from './nativeSlot';
import { usePlusHeight } from './height';
import { t } from './text';
import { normalizeObjectLink } from './links';

interface Props {
	rootId: string;
	block: I.Block;
	html: string;
	isPopup?: boolean;
	readonly?: boolean;
};

// Estilos base dentro del shadow DOM. Las variables --plus-* apuntan a los colores reales de Anytype,
// así el HTML sigue el tema de la app (claro, oscuro o los que se agreguen) sin hacer nada.
const BASE_CSS = `
:host {
	display: block; position: relative; color: var(--color-text-primary); font-size: 14px; line-height: 1.5;
	--plus-bg: var(--color-bg-primary); --plus-surface: var(--color-shape-highlight-light);
	--plus-text: var(--color-text-primary); --plus-muted: var(--color-text-secondary);
	--plus-border: var(--color-shape-secondary); --plus-accent: var(--color-system-accent-100);
	--plus-radius: 10px;
}
.plus-body { display: flow-root; }
a { color: var(--plus-accent); cursor: pointer; }
img, video { max-width: 100%; }
.plus-card { background: var(--plus-surface); border: 1px solid var(--plus-border); border-radius: var(--plus-radius); padding: 16px 20px; }
.plus-card h2 { font-size: 20px; margin: 0 0 6px 0; }
.plus-card p { margin: 0; color: var(--plus-muted); }
.plus-card p + p { margin-top: 6px; }
anytype-view { display: block; min-width: 0; max-width: 100%; overflow: hidden; }
anytype-list { display: contents; }
anytype-folders { display: block; }
anytype-changes { display: contents; }
.plus-folders { display: flex; flex-direction: column; gap: 1px; }
.plus-folders-dir > summary { list-style: none; display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 6px; font-weight: 500; }
.plus-folders-dir > summary::-webkit-details-marker { display: none; }
.plus-folders-dir > summary::before { content: '›'; width: 12px; color: var(--plus-muted); transition: transform 0.15s; display: inline-block; text-align: center; }
.plus-folders-dir[open] > summary::before { transform: rotate(90deg); }
.plus-folders-children { display: flex; flex-direction: column; gap: 1px; margin-left: 12px; padding-left: 8px; border-left: 1px solid var(--plus-border); }
.plus-folders-file { display: flex; align-items: center; gap: 8px; padding: 3px 6px 3px 24px; border-radius: 6px; color: var(--plus-text); text-decoration: none; min-width: 0; }
.plus-folders-dir > summary:hover, .plus-folders-file:hover { background: var(--color-shape-highlight-medium); }
.plus-folders-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plus-folders-count, .plus-folders-hint { color: var(--plus-muted); font-size: 12px; font-weight: 400; }
.plus-folders-hint { flex: 0 10 auto; min-width: 0; max-width: 40%; overflow: hidden; text-overflow: ellipsis; padding-left: 12px; white-space: nowrap; }
anytype-folders[hint="no"] .plus-folders-hint { display: none; }
anytype-object, anytype-prop { display: inline-block; vertical-align: middle; }
anytype-object[as="card"], anytype-object[as="embed"] { display: block; }
`;

/**
 * Convierte el CSS del autor en una hoja para el shadow DOM. replaceSync descarta los @import (no se piden
 * hojas externas) y los selectores html/body/:root se llevan al contenedor.
 */
const buildSheet = (css: string): CSSStyleSheet => {
	const sheet = new CSSStyleSheet();

	try {
		sheet.replaceSync(css);
	} catch (e) {
		return sheet;
	};

	const walk = (rules: CSSRuleList) => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSStyleRule) {
				const scoped = scopeSelector(rule.selectorText);

				if (scoped != rule.selectorText) {
					try { rule.selectorText = scoped; } catch (e) { /**/ };
				};
			};

			const inner = (rule as any).cssRules;
			if (inner && inner.length) {
				walk(inner);
			};
		};
	};

	walk(sheet.cssRules);
	return sheet;
};

const baseSheet = (() => {
	let sheet: CSSStyleSheet = null;
	return () => {
		if (!sheet) {
			sheet = new CSSStyleSheet();
			sheet.replaceSync(BASE_CSS);
		};
		return sheet;
	};
})();

const PlusHtmlNative = forwardRef<HTMLDivElement, Props>((props, ref) => {

	const { rootId, block, html, readonly, isPopup } = props;
	const hostRef = useRef<HTMLDivElement>(null);
	const shadowRef = useRef<ShadowRoot>(null);
	const parsed = useMemo(() => parseHtml(html), [ html ]);
	const [ slots, setSlots ] = useState<PlusSlot[]>([]);
	const [ lists, setLists ] = useState<PlusList[]>([]);
	// Cuántas veces se armó el shadow DOM: las listas lo usan para volver a llenarse al editar el HTML
	const [ renderKey, setRenderKey ] = useState(0);
	const nodeRef = useRef<HTMLDivElement>(null);
	const size = usePlusHeight(rootId, block, readonly, () => nodeRef.current?.offsetHeight || 0);
	const height = size.drag || size.fixed;
	const isEmpty = !String(html || '').trim();

	// Marcado y estilos del autor dentro del shadow DOM
	useEffect(() => {
		const host = hostRef.current;
		if (!host) {
			return;
		};

		if (!shadowRef.current) {
			shadowRef.current = host.attachShadow({ mode: 'open' });
			shadowRef.current.addEventListener('click', onClick);
		};

		const shadow = shadowRef.current;
		const body = document.createElement('div');

		body.className = [ 'plus-body', parsed.bodyClass ].join(' ').trim();
		if (parsed.bodyStyle) {
			body.setAttribute('style', parsed.bodyStyle);
		};
		body.innerHTML = parsed.html;

		// Imágenes y archivos de Anytype por id
		body.querySelectorAll('img[src^="anytype://file/"]').forEach((img: HTMLImageElement) => {
			const id = String(img.getAttribute('src')).replace('anytype://file/', '').split(/[?#]/)[0];
			img.setAttribute('src', S.Common.imageUrl(id, I.ImageSize.Large));
		});

		shadow.adoptedStyleSheets = [ baseSheet() ].concat(parsed.css.map(buildSheet));
		shadow.replaceChildren(body);

		setSlots(parsed.slots);
		setLists(parsed.lists);
		setRenderKey(v => v + 1);
	}, [ parsed ]);

	// Los enlaces los abre Anytype: objetos dentro de la app, web en el navegador
	const onClick = (e: Event) => {
		const link = e.composedPath().find((el: any) => el?.tagName == 'A') as HTMLAnchorElement;
		if (!link) {
			return;
		};

		e.preventDefault();

		const href = link.getAttribute('href') || '';
		if (!href || href.startsWith('#')) {
			return;
		};

		const target = U.Embed.getLinkTarget(normalizeObjectLink(href, S.Common.space));
		if (target) {
			Action.openUrl(target);
		};
	};

	const cn = [ 'plusHtmlNative' ];
	if (height) {
		cn.push('isFixed');
	};
	if (size.isDragging) {
		cn.push('isDragging');
	};

	return (
		<div ref={ref} className={cn.join(' ')} contentEditable={false} suppressContentEditableWarning={true}>
			{isEmpty ? <div className="plusMessage">{t('emptyHtml')}</div> : ''}
			<div ref={nodeRef} className="plusScroll" style={height ? { height } : {}}>
			<div ref={hostRef} className="plusHost">
				{slots.map((slot, i) => {
					// Si el mismo objeto aparece varias veces, cada aparición tiene su propia vista
					const same = (it: PlusSlot) => (it.tag == slot.tag) && (it.attrs.object == slot.attrs.object);
					const occurrence = slots.slice(0, i).filter(same).length;

					return (
						<div key={slot.name} slot={slot.name} className={[ 'plusSlot', U.String.toCamelCase(slot.tag) ].join(' ')}>
							<PlusNativeSlot rootId={rootId} block={block} slot={slot} readonly={readonly} isPopup={isPopup} occurrence={occurrence} />
						</div>
					);
				})}
			</div>
			</div>
			{lists.map(def => (def.tag == 'anytype-changes') ? (
				<PlusChangesFiller
					key={def.name}
					rootId={rootId}
					def={def}
					renderKey={renderKey}
					getElement={() => shadowRef.current?.querySelector(`[data-plus-list="${def.name}"]`) as HTMLElement}
				/>
			) : (
				<PlusListFiller
					key={def.name}
					rootId={rootId}
					blockId={block.id}
					def={def}
					renderKey={renderKey}
					getElement={() => shadowRef.current?.querySelector(`[data-plus-list="${def.name}"]`) as HTMLElement}
				/>
			))}
			{size.handle}
		</div>
	);

});

export default PlusHtmlNative;
