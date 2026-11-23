// plus: HTML en vivo, modo aislado.
// Un bloque de código con lenguaje `html-vivo` cuyo HTML trae scripts se dibuja en el iframe aislado del
// embed «Anytype Mini App» (otro origen, sin acceso a la sesión ni a los datos). El HTML sin scripts se
// dibuja en modo nativo (htmlNative.tsx). El Anytype oficial muestra el bloque como código normal.

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import * as I from 'Interface';
import { usePlusHeight, MIN_HEIGHT } from './height';
import { normalizeObjectLink } from './links';

export { resetHtmlLiveHeight } from './height';

export const PLUS_HTML_LANG = 'html-vivo';

export const isHtmlLive = (block: I.Block): boolean => {
	return Boolean(block?.isTextCode?.() && (String(block.fields?.lang || '') == PLUS_HTML_LANG));
};

interface Props {
	rootId: string;
	block: I.Block;
	html: string;
	readonly?: boolean;
};

const PlusHtmlLive = forwardRef<HTMLDivElement, Props>((props, ref) => {

	const { rootId, block, html, readonly } = props;
	const theme = S.Common.getThemeClass();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const loadedRef = useRef(false);
	const htmlRef = useRef(html);
	const [ autoHeight, setAutoHeight ] = useState(MIN_HEIGHT);
	const size = usePlusHeight(rootId, block, readonly, () => iframeRef.current?.offsetHeight || autoHeight);
	const height = size.drag || size.fixed || autoHeight;

	htmlRef.current = html;

	const post = () => {
		const iw = iframeRef.current?.contentWindow;
		if (!iw || !loadedRef.current) {
			return;
		};

		iw.postMessage({
			anytypeMiniApp: { html: htmlRef.current, state: null },
			plusLive: true,
			allowIframeResize: true,
			align: block.hAlign,
			processor: I.EmbedProcessor.AnytypeMiniApp,
			blockId: block.id,
		}, U.Embed.getIframeOrigin());
	};

	// Cambios del código: se vuelve a dibujar el HTML
	useEffect(() => post(), [ html ]);

	// Mensajes del iframe: alto del contenido y enlaces
	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== iframeRef.current?.contentWindow) {
				return;
			};

			const { type, blockId, url } = e.data || {};
			if (blockId != block.id) {
				return;
			};

			switch (type) {
				case 'resize': {
					setAutoHeight(Math.max(MIN_HEIGHT, Number(e.data.height) || 0));
					break;
				};

				case 'openUrl': {
					const target = U.Embed.getLinkTarget(normalizeObjectLink(url, S.Common.space));
					if (target) {
						Action.openUrl(target);
					};
					break;
				};
			};
		};

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [ block.id ]);

	const onLoad = () => {
		loadedRef.current = true;
		post();
	};

	const cn = [ 'plusHtmlLive' ];
	if (size.isFixed) {
		cn.push('isFixed');
	};
	if (size.isDragging) {
		cn.push('isDragging');
	};

	return (
		<div ref={ref} className={cn.join(' ')} contentEditable={false} suppressContentEditableWarning={true}>
			<iframe
				key={`${theme}-${size.isFixed ? 'fixed' : 'auto'}`}
				ref={iframeRef}
				src={U.Embed.getIframeUrl(theme)}
				sandbox="allow-scripts allow-same-origin allow-popups"
				allow={U.Embed.getIframeAllow(I.EmbedProcessor.AnytypeMiniApp)}
				referrerPolicy="strict-origin-when-cross-origin"
				scrolling={size.isFixed ? 'auto' : 'no'}
				style={{ height }}
				onLoad={onLoad}
			/>
			{size.handle}
		</div>
	);

});

export default PlusHtmlLive;
