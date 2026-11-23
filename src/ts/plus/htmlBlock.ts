// plus: insertar HTML desde el menú `/html`.
// El menú crea un embed «Mini App»; lo cambiamos por un único bloque de código con lenguaje `html-vivo`
// (ver htmlLive.tsx), el mismo formato que se crea por MCP o desde un sync externo.
// Los embeds Mini App que ya existen siguen funcionando.

import * as I from 'Interface';
import { PLUS_HTML_LANG } from './htmlLive';

export const PLUS_HTML_TEMPLATE = `<div class="plus-card">
  <h2>Título</h2>
  <p>Edita este HTML con «Ver código». Usa las variables de tema
  (var(--plus-text), var(--plus-accent)…) para que se vea bien en claro y oscuro.</p>
  <p><a href="https://anytype.io">Enlace web</a> · Objeto: anytype://object?objectId=ID&amp;spaceId=ESPACIO</p>
</div>`;

export const isMiniApp = (param: any): boolean => {
	return (param?.type == I.BlockType.Embed) && (param?.content?.processor == I.EmbedProcessor.AnytypeMiniApp);
};

/**
 * Reemplaza el embed recién creado por un bloque de código «HTML en vivo» con una plantilla.
 * BlockCreate no guarda `fields`, por eso el lenguaje se pone después con BlockListSetFields.
 */
export const replaceWithHtmlLive = (rootId: string, embedBlockId: string, html: string = PLUS_HTML_TEMPLATE, callBack?: (blockId: string) => void) => {
	const param = {
		type: I.BlockType.Text,
		content: { style: I.TextStyle.Code, text: html },
	};

	C.BlockCreate(rootId, embedBlockId, I.BlockPosition.Top, param, (message: any) => {
		if (message.error?.code || !message.blockId) {
			return;
		};

		const blockId = message.blockId;

		C.BlockListSetFields(rootId, [ { blockId, fields: { lang: PLUS_HTML_LANG } } ], () => {
			C.BlockListDelete(rootId, [ embedBlockId ], () => callBack?.(blockId));
		});
	});
};
