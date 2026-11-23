// plus: fila fija «Cambios» en la barra lateral del espacio, con el número de cambios sin ver. Abre la bandeja.

import React, { MouseEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Icon, Label } from 'Component';
import { getUnreadCount, openRecent, INBOX_ROUTE } from './changeAlerts';
import { t } from './text';

const PlusChangesWidget = observer(() => {

	const count = getUnreadCount(S.Common.space);
	const isActive = (keyboard.getMatch(false)?.params?.action == INBOX_ROUTE.split('/').pop());
	const cn = [ 'widget', 'widgetLink', 'plusChangesWidget', (isActive ? 'isActive' : '') ];

	const onClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		openRecent();
	};

	return (
		<div id="widget-plus-changes" className={cn.join(' ')} onClick={onClick}>
			<div className="head">
				<div className="sides">
					<div className="side left">
						<div className="clickable">
							<Icon name="settings/pushOn" />
							<Label className="name" text={t('inboxTitle')} />
						</div>
					</div>
					<div className="side right">
						{count ? (
							<div className="chatCounter">
								<Icon className="message" inner={String(count)} />
							</div>
						) : ''}
					</div>
				</div>
			</div>
		</div>
	);

});

export default PlusChangesWidget;
