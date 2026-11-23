// plus: <anytype-changes>, los cambios recientes de otras personas dentro de una página HTML (F11).
//     <anytype-changes limit="10" space="actual|todos"></anytype-changes>
// Sale de la misma fuente que la bandeja: lo que otras personas editaron después de «visto hasta». Sin contenido
// usa la fila por defecto (.row, .e, .t, .m); con contenido, ese HTML es la plantilla de cada fila, con
// {{url}} {{icon}} {{name}} {{who}} {{when}} {{type}} {{space}} y {{unread}} («unread» si no se ha visto).

import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { PlusList } from './htmlParse';
import { getInbox, getInboxSpaces, getInboxState, agoText, sinceText } from './changeAlerts';
import { isUnread, renderChangeRow } from './changesInbox';
import { t } from './text';

interface Props {
	rootId: string;
	def: PlusList;
	getElement: () => HTMLElement;
	renderKey?: number;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const PlusChangesFiller = observer((props: Props) => {

	const { rootId, def, getElement, renderKey } = props;
	const limit = Math.min(MAX_LIMIT, Math.max(1, Number(def.attrs.limit) || DEFAULT_LIMIT));
	const isAll = [ 'todos', 'all' ].includes(String(def.attrs.space || '').toLowerCase());
	// El espacio de la página (no el que esté activo)
	const spaceId = S.Detail.get(rootId, rootId, [ 'spaceId' ], true).spaceId || S.Common.space;
	const spaceIds = isAll ? getInboxSpaces() : [ spaceId ];
	const changes = spaceIds.flatMap(getInbox).sort((a, b) => b.date - a.date).slice(0, limit);
	const seenUntil = getInboxState(spaceId).seenUntil;
	const html = changes.map(it => renderChangeRow(def.template.trim(), {
		url: `anytype://object?objectId=${it.id}&spaceId=${it.spaceId}`,
		icon: it.iconEmoji || '📄',
		name: it.name,
		who: it.who,
		when: agoText(it.date),
		type: it.typeName,
		space: U.Space.getSpaceviewBySpaceId(it.spaceId)?.name || '',
		unread: isUnread(it, getInboxState(it.spaceId)) ? 'unread' : '',
	})).join('');
	const empty = (seenUntil && !isAll) ? U.String.sprintf(t('inboxEmpty'), sinceText(seenUntil)) : t('inboxEmptyNever');

	useEffect(() => {
		const el = getElement();
		if (!el) {
			return;
		};

		if (html) {
			el.innerHTML = html;
		} else {
			el.innerHTML = renderChangeRow('<div class="row"><span class="m">{{name}}</span></div>', { name: empty });
		};
	}, [ html, empty, renderKey ]);

	return null;

});

export default PlusChangesFiller;
