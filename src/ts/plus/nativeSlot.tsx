// plus: piezas nativas de Anytype dentro del HTML.
// Cada etiqueta <anytype-*> del HTML se cambia por uno de estos componentes, que son los de Anytype de verdad
// (no copias): la vista de un set es el mismo bloque dataview que se ve al abrir el set.

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Block, Loader, IconObject, ObjectName } from 'Component';
import * as I from 'Interface';
import { PlusSlot } from './htmlParse';
import { t } from './text';
import PlusEmbedObject, { getEmbedChain } from './embedObject';

interface Props {
	rootId: string;
	block: I.Block;
	slot: PlusSlot;
	isPopup?: boolean;
	readonly?: boolean;
	occurrence?: number; // cuál de las vistas del mismo objeto es (0 = la primera)
};

/**
 * Acepta un id de objeto o un enlace anytype://object?objectId=…
 */
export const getObjectIdFromAttr = (value: string): string => {
	const v = String(value || '').trim();
	const m = v.match(/objectId=([^&]+)/);

	return m ? decodeURIComponent(m[1]) : v;
};

const Message = ({ text }: { text: string }) => <div className="plusMessage">{text}</div>;

// Vistas que se están creando, para no crear dos veces la misma mientras llega la respuesta
const creating: Set<string> = new Set();

/**
 * <anytype-view object="ID" view="nombre o id">: la vista nativa (tabla, lista, galería, kanban, calendario…)
 * de un set, una colección o un tipo.
 *
 * Es el «set en línea» de Anytype de verdad: un bloque dataview hijo del bloque HTML, con ese objeto como
 * origen. Si el HTML pide una vista que todavía no tiene su bloque, se crea sola (con permiso de edición).
 * Anytype no dibuja los hijos de un bloque de código, así que cada vista aparece solo donde el HTML la pone.
 */
const PlusViewSlot = observer(forwardRef<HTMLDivElement, Props>((props, ref) => {

	const { rootId, block, slot, isPopup, readonly, occurrence } = props;
	const objectId = getObjectIdFromAttr(slot.attrs.object || slot.attrs.source);
	const viewAttr = String(slot.attrs.view || '').trim();
	const viewAppliedRef = useRef(false);
	const boxRef = useRef<HTMLDivElement>(null);

	const [ error, setError ] = useState('');
	const candidates = S.Block.getChildren(rootId, block.id, it => it.isDataview() && (it.getTargetObjectId() == objectId));
	const dataview = candidates[occurrence || 0];
	const key = [ rootId, block.id, objectId, occurrence || 0 ].join(':');

	// Las vistas de Anytype se miden al montarse y al cambiar la ventana (pestañas o menú desplegable,
	// ancho de columnas). Dentro del HTML su espacio cambia sin que cambie la ventana: se avisa igual.
	useEffect(() => {
		const el = boxRef.current;
		if (!el || (typeof ResizeObserver == 'undefined')) {
			return;
		};

		let timer = 0;
		let last = el.offsetWidth;
		const observer = new ResizeObserver(() => {
			if (el.offsetWidth == last) {
				return;
			};

			last = el.offsetWidth;
			window.clearTimeout(timer);
			timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
		});

		observer.observe(el);
		return () => {
			window.clearTimeout(timer);
			observer.disconnect();
		};
	}, [ dataview?.id ]);

	useEffect(() => {
		if (dataview || !objectId || readonly || creating.has(key)) {
			return;
		};

		creating.add(key);

		const param = { type: I.BlockType.Dataview, content: { isCollection: false, views: [] } };

		C.BlockCreate(rootId, block.id, I.BlockPosition.Inner, param, (message: any) => {
			if (message.error?.code || !message.blockId) {
				creating.delete(key);
				setError(t('viewCreateError'));
				return;
			};

			C.BlockDataviewCreateFromExistingObject(rootId, message.blockId, objectId, (message: any) => {
				creating.delete(key);

				if (message.error?.code) {
					setError(t('viewNoViews'));
				};
			});
		});
	}, [ dataview?.id, objectId, readonly ]);

	if (!objectId) {
		return <Message text={t('viewMissingAttr')} />;
	};

	if (error) {
		return <Message text={error} />;
	};

	if (!dataview) {
		return readonly
			? <Message text={t('viewReadonly')} />
			: <div className="plusLoading"><Loader /></div>;
	};

	// Vista pedida por nombre o por id. Solo al montar: después manda lo que la persona elija en las pestañas
	if (viewAttr && !viewAppliedRef.current) {
		const views = S.Record.getViews(rootId, dataview.id);
		const view = views.find(it => (it.id == viewAttr) || (String(it.name || '').toLowerCase() == viewAttr.toLowerCase()));

		if (view) {
			viewAppliedRef.current = true;
			S.Record.metaSet(S.Record.getSubId(rootId, dataview.id), '', { viewId: view.id });
		};
	};

	return (
		<div ref={(el) => { boxRef.current = el; if (typeof ref == 'function') { ref(el); } else if (ref) { ref.current = el; }; }} className="plusView">
			<Block
				key={dataview.id}
				rootId={rootId}
				block={dataview}
				isPopup={isPopup}
				iconSize={20}
				className="noPlus"
				isSelectionDisabled={true}
				readonly={readonly}
			/>
		</div>
	);

}));

/**
 * <anytype-object object="ID">: un objeto concreto como enlace vivo con su ícono y su nombre actual.
 */
const PlusObjectSlot = observer(forwardRef<HTMLSpanElement, Props>((props, ref) => {

	const { slot } = props;
	const objectId = getObjectIdFromAttr(slot.attrs.object);
	const subId = `plus-object-${objectId}`;
	const [ loaded, setLoaded ] = useState(false);

	useEffect(() => {
		if (!objectId) {
			return;
		};

		U.Subscription.subscribeIds({
			subId,
			ids: [ objectId ],
			keys: J.Relation.default,
			noDeps: true,
		}, () => setLoaded(true));

		return () => {
			U.Subscription.destroyList([ subId ]);
		};
	}, [ objectId ]);

	if (!objectId) {
		return <Message text={t('objectMissingAttr')} />;
	};

	const object = S.Detail.get(subId, objectId, J.Relation.default);

	if (!loaded) {
		return <span ref={ref} className="plusObject isLoading" />;
	};

	if (object._empty_ || object.isDeleted) {
		return <span ref={ref} className="plusObject isMissing">{t('objectMissing')}</span>;
	};

	const onClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		U.Object.openEvent(e, object);
	};

	return (
		<span ref={ref} className="plusObject" onClick={onClick}>
			<IconObject object={object} size={20} iconSize={20} />
			<ObjectName object={object} />
		</span>
	);

}));

const PlusNativeSlot = forwardRef<any, Props>((props, ref) => {
	switch (props.slot.tag) {
		case 'anytype-view': return <PlusViewSlot ref={ref} {...props} />;
		case 'anytype-object': {
			// as="embed": el documento completo, en solo lectura
			if (props.slot.attrs.as == 'embed') {
				const objectId = getObjectIdFromAttr(props.slot.attrs.object);
				const spaceId = S.Detail.get(props.rootId, props.rootId, [ 'spaceId' ], true).spaceId || S.Common.space;

				return objectId ? <PlusEmbedObject objectId={objectId} spaceId={spaceId} parentIds={getEmbedChain(props.rootId)} /> : <Message text={t('objectMissingAttr')} />;
			};
			return <PlusObjectSlot ref={ref} {...props} />;
		};
	};

	return <Message text={`<${props.slot.tag}> ${t('tagNotReady')}`} />;
});

export default PlusNativeSlot;
