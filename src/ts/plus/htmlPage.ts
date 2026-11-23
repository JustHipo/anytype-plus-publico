// plus: tipo «Página HTML».
// Un objeto de ese tipo se ve como una página web a página completa: su primer bloque (el HTML en vivo)
// ocupa toda la página, sin título ni marco, y un botón alterna entre ver la página y editar su HTML.
// El tipo se crea por la API con la clave `html_page` (ver plus/GUIA_HTML_PARA_IA.md); Anytype la guarda en
// el dato `apiObjectKey` del tipo, que el cliente no carga por defecto: se consulta una vez por espacio.

import { observable, runInAction } from 'mobx';
import * as I from 'Interface';

export const PLUS_PAGE_TYPE_KEY = 'html_page';

const RETRY_MS = 10000;
const typeIds = observable.map<string, string>();
const checkedAt: Map<string, number> = new Map();
const loading: Set<string> = new Set();

const load = (spaceId: string) => {
	if (loading.has(spaceId)) {
		return;
	};

	loading.add(spaceId);

	const filters: any[] = [
		{ relationKey: 'apiObjectKey', condition: I.FilterCondition.Equal, value: PLUS_PAGE_TYPE_KEY },
		{ relationKey: 'resolvedLayout', condition: I.FilterCondition.Equal, value: I.ObjectLayout.Type },
	];

	C.ObjectSearch(spaceId, filters, [], [ 'id' ], '', 0, 1, (message: any) => {
		loading.delete(spaceId);
		checkedAt.set(spaceId, Date.now());

		runInAction(() => typeIds.set(spaceId, String(message.records?.[0]?.id || '')));
	});
};

/**
 * Id del tipo «Página HTML» en un espacio; vacío si el espacio no lo tiene (o mientras se consulta).
 */
export const getHtmlPageTypeId = (spaceId: string): string => {
	if (!spaceId) {
		return '';
	};

	const id = typeIds.get(spaceId);

	// Sin respuesta todavía, o el espacio no tenía el tipo hace un rato: volver a preguntar
	if ((id === undefined) || (!id && (Date.now() - (checkedAt.get(spaceId) || 0) > RETRY_MS))) {
		load(spaceId);
	};

	return id || '';
};

/**
 * Marca para ver como Página HTML un objeto de cualquier tipo: `<!-- plus:pagina -->` o
 * `<meta name="plus" content="pagina">` en el HTML de su primer bloque. Así el objeto conserva su tipo.
 */
const PAGE_MARK = /<!--\s*plus:pagina\s*-->|<meta\s[^>]*name\s*=\s*["']plus["'][^>]*content\s*=\s*["']pagina["'][^>]*>|<meta\s[^>]*content\s*=\s*["']pagina["'][^>]*name\s*=\s*["']plus["'][^>]*>/i;

export const hasPageMark = (html: string): boolean => PAGE_MARK.test(String(html || ''));

/**
 * ¿Este bloque es el HTML principal de una Página HTML? Es el primer bloque del cuerpo de un objeto del tipo
 * «Página HTML», o de cualquier objeto cuyo HTML trae la marca de página.
 */
export const isHtmlPageBlock = (rootId: string, block: I.Block): boolean => {
	const first = S.Block.getChildren(rootId, rootId, it => !it.isLayoutHeader())[0];

	if (first?.id != block.id) {
		return false;
	};

	if (hasPageMark(block.content?.text)) {
		return true;
	};

	const object = S.Detail.get(rootId, rootId, [ 'type', 'spaceId' ], true);
	const typeId = getHtmlPageTypeId(object.spaceId || S.Common.space);

	return !!typeId && (object.type == typeId);
};
