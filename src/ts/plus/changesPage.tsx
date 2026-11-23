// plus: página «Cambios» (F11), la bandeja con lo que otras personas editaron después de «visto hasta».
// Una entrada por persona y ráfaga, que se despliega en sus objetos. Abrir un objeto lo marca visto.

import React, { forwardRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Header, Footer, IconObject, Icon, Label, Select, Button } from 'Component';
import * as I from 'Interface';
import { PlusChange, PlusChangeGroup, groupChanges, isUnread } from './changesInbox';
import { getInbox, getInboxSpaces, getInboxState, markSpaceSeen, openChange, changesSubId, agoText, sinceText } from './changeAlerts';
import { t } from './text';

type Scope = 'space' | 'all';

const countText = (n: number) => (n == 1) ? t('inboxOne') : U.String.sprintf(t('inboxMany'), n);

const PlusChangesPage = observer(forwardRef<I.PageRef, I.PageComponent>((props, ref) => {

	const space = S.Common.space;
	const [ scope, setScope ] = useState<Scope>('space');
	const [ typeId, setTypeId ] = useState('');
	const [ opened, setOpened ] = useState<string[]>([]);
	const spaceIds = (scope == 'space') ? [ space ] : getInboxSpaces();
	const all = spaceIds.flatMap(getInbox).sort((a, b) => b.date - a.date);
	const typeOptions: I.Option[] = [ { id: '', name: t('inboxAllTypes') } ];

	for (const change of all) {
		if (change.typeId && !typeOptions.find(it => it.id == change.typeId)) {
			typeOptions.push({ id: change.typeId, name: change.typeName || change.typeId });
		};
	};

	const list = typeId ? all.filter(it => it.typeId == typeId) : all;
	const groups = groupChanges(list, getInboxState);
	const unread = list.filter(it => isUnread(it, getInboxState(it.spaceId))).length;
	const seenUntil = getInboxState(space).seenUntil;
	const scopeOptions: I.Option[] = [
		{ id: 'space', name: t('inboxThisSpace') },
		{ id: 'all', name: t('inboxAllSpaces') },
	];

	const onToggle = (key: string) => {
		setOpened(opened.includes(key) ? opened.filter(it => it != key) : opened.concat([ key ]));
	};

	const onMarkAll = () => {
		spaceIds.forEach(markSpaceSeen);
	};

	const renderChange = (change: PlusChange, withWho: boolean) => {
		const isNew = isUnread(change, getInboxState(change.spaceId));
		const cn = [ 'plusInboxItem', (isNew ? 'isUnread' : '') ];
		const spaceName = (scope == 'all') ? U.Space.getSpaceviewBySpaceId(change.spaceId)?.name : '';
		const info = [ (withWho ? change.who : ''), change.typeName, spaceName, agoText(change.date) ].filter(it => it).join(' · ');

		return (
			<div key={`${change.spaceId}-${change.id}`} className={cn.join(' ')} onClick={() => openChange(change)}>
				<div className="dot" />
				<IconObject object={{ id: change.id, name: change.name, layout: change.layout, iconEmoji: change.iconEmoji }} size={20} />
				<Label className="name" text={change.name} />
				<Label className="info" text={info} />
			</div>
		);
	};

	const renderGroup = (group: PlusChangeGroup) => {
		if (group.changes.length == 1) {
			return renderChange(group.changes[0], true);
		};

		const isOpen = opened.includes(group.key);
		const who = S.Detail.get(changesSubId(group.spaceId), group.whoId, []);
		const cn = [ 'plusInboxGroup', (isOpen ? 'isOpen' : ''), (group.unread ? 'isUnread' : '') ];
		const spaceName = (scope == 'all') ? U.Space.getSpaceviewBySpaceId(group.spaceId)?.name : '';
		const info = [ countText(group.changes.length), spaceName, agoText(group.date) ].filter(it => it).join(' · ');

		return (
			<div key={group.key} className={cn.join(' ')}>
				<div className="plusInboxItem head" onClick={() => onToggle(group.key)}>
					<div className="dot" />
					<IconObject object={who._empty_ ? { name: group.who, layout: I.ObjectLayout.Participant } : who} size={20} />
					<Label className="name" text={group.who} />
					<Label className="info" text={info} />
					<Icon name="arrow/button" size={8} className="arrow" />
				</div>
				{isOpen ? <div className="children">{group.changes.map(it => renderChange(it, false))}</div> : ''}
			</div>
		);
	};

	const empty = seenUntil && (scope == 'space') && !typeId ? U.String.sprintf(t('inboxEmpty'), sinceText(seenUntil)) : t('inboxEmptyNever');

	return (
		<>
			<Header {...props} component="mainEmpty" />

			<div className="wrapper plusInbox">
				<div className="titleWrapper">
					<div className="side left">
						<div className="title">{t('inboxTitle')}</div>
						{unread ? <span className="cnt">{unread}</span> : ''}
					</div>
					<div className="side right">
						<Select id="plusInboxScope" value={scope} options={scopeOptions} onChange={(v: string) => setScope(v as Scope)} arrowClassName="black" />
						<Select id="plusInboxType" value={typeId} options={typeOptions} onChange={(v: string) => setTypeId(v)} arrowClassName="black" />
						<Button text={t('inboxMarkAll')} color="blank" size={28} className={unread ? '' : 'disabled'} onClick={onMarkAll} />
					</div>
				</div>

				<div className="plusInboxList">
					{groups.length ? groups.map(renderGroup) : <div className="plusInboxEmpty">{empty}</div>}
				</div>
			</div>

			<Footer {...props} component="mainObject" />
		</>
	);

}));

export default PlusChangesPage;
