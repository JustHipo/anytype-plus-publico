// plus: un objeto completo dentro de otro, en solo lectura.
// Se abre aparte (ObjectShow con su propio traceId, como hace la vista previa de Anytype), así sus bloques
// quedan en el store con un contexto propio (`id-traceId`). Los cambios hechos desde esta misma app no llegan a
// ese contexto, así que además se sigue la fecha de modificación del objeto con una suscripción (que sí ve todos
// los cambios) y se vuelve a cargar cuando cambia. Se dibuja con los bloques reales de Anytype. Para editarlo,
// se abre el objeto con el encabezado.

import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Block, IconObject, ObjectName, Loader } from 'Component';
import * as I from 'Interface';
import { t } from './text';

interface Props {
	objectId: string;
	spaceId: string;
	// Para no incrustar un objeto dentro de sí mismo (o en ciclo)
	parentIds?: string[];
};

let counter = 0;
const RELOAD_DELAY = 500;

// Cadena de objetos incrustados por contexto, para cortar ciclos (A dentro de B dentro de A)
const chains: Map<string, string[]> = new Map();

/** Objetos que ya están en la cadena de una página o de un incrustado (su contexto es `rootId`). */
export const getEmbedChain = (rootId: string): string[] => chains.get(rootId) || [ rootId ];

const PlusEmbedObject = observer((props: Props) => {

	const { objectId, spaceId, parentIds = [] } = props;
	const traceId = useRef(`plus-embed-${++counter}`).current;
	const contextId = [ objectId, traceId ].join('-');
	const [ state, setState ] = useState<'loading' | 'ready' | 'error'>('loading');
	const isCycle = parentIds.includes(objectId);
	const metaSubId = `${contextId}-meta`;
	const modified = S.Detail.get(metaSubId, objectId, [ 'lastModifiedDate' ], true).lastModifiedDate;

	// Contexto abierto: al desmontar se cierra, y una respuesta que llegue después también se cierra
	const aliveRef = useRef(false);
	// Fecha de modificación de lo último cargado: evita la segunda carga al llegar la suscripción
	const loadedRef = useRef<number | null>(null);

	useEffect(() => {
		if (!objectId || isCycle) {
			return;
		};

		aliveRef.current = true;
		loadedRef.current = null;
		chains.set(contextId, parentIds.concat([ objectId ]));
		setState('loading');

		U.Subscription.subscribeIds({
			spaceId,
			subId: metaSubId,
			ids: [ objectId ],
			keys: [ 'id', 'lastModifiedDate' ],
			noDeps: true,
		});

		load();

		return () => {
			aliveRef.current = false;
			chains.delete(contextId);
			U.Subscription.destroyList([ metaSubId ]);
			Action.pageClose(false, contextId, false);
		};
	}, [ objectId, spaceId ]);

	const load = () => {
		C.ObjectShow(objectId, traceId, spaceId, (message: any) => {
			if (!aliveRef.current) {
				Action.pageClose(false, contextId, false);
				return;
			};

			setState(message.error?.code ? 'error' : 'ready');
		});
	};

	// Recarga cuando el original cambia (con una pausa: mientras alguien escribe cambia a cada tecla)
	useEffect(() => {
		if (!objectId || isCycle || (modified === undefined)) {
			return;
		};

		// La primera fecha que llega es la de lo que ya se cargó al montar
		if (loadedRef.current === null) {
			loadedRef.current = modified;
			return;
		};

		if (loadedRef.current == modified) {
			return;
		};

		const timer = window.setTimeout(() => {
			loadedRef.current = modified;
			load();
		}, RELOAD_DELAY);

		return () => window.clearTimeout(timer);
	}, [ modified ]);

	if (isCycle) {
		return <div className="plusEmbed isMessage">{t('embedCycle')}</div>;
	};

	if (state == 'loading') {
		return <div className="plusEmbed isLoading"><Loader /></div>;
	};

	const object = S.Detail.get(contextId, objectId, J.Relation.default);

	if ((state == 'error') || object._empty_ || object.isDeleted) {
		return <div className="plusEmbed isMessage">{t('objectMissing')}</div>;
	};

	const children = S.Block.getChildren(contextId, objectId, it => !it.isLayoutHeader());

	const onOpen = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		U.Object.openEvent(e, object);
	};

	return (
		<div className="plusEmbed" contentEditable={false} suppressContentEditableWarning={true}>
			<div className="plusEmbedHead" onClick={onOpen} title={t('embedOpen')}>
				<IconObject object={object} size={20} iconSize={20} />
				<ObjectName object={object} />
			</div>
			<div className="blocks plusEmbedBlocks">
				{children.map((block: I.Block, i: number) => (
					<Block
						key={block.id}
						rootId={contextId}
						index={i}
						block={block}
						readonly={true}
						isPopup={false}
						getWrapperWidth={() => 0}
					/>
				))}
			</div>
		</div>
	);

});

export default PlusEmbedObject;
