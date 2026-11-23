// plus: sección de Ajustes → Personal para los avisos de cambios del espacio actual. La lista de cambios vive en
// la bandeja «Cambios» de la barra lateral; aquí queda un enlace a ella.

import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Label, Select, Button } from 'Component';
import * as I from 'Interface';
import { getAlertConfig, setAlertConfig, openRecent, PlusAlertMode } from './changeAlerts';
import { t } from './text';

const PlusChangeAlertsSettings = observer(() => {

	const spaceId = S.Common.space;
	const [ config, setConfig ] = useState(getAlertConfig(spaceId));
	const types = S.Record.getTypes().filter(it => !U.Object.isInSystemLayouts(it.recommendedLayout));

	const modes: I.Option[] = [
		{ id: '', name: t('alertModeOff') },
		{ id: 'all', name: t('alertModeAll') },
		{ id: 'types', name: t('alertModeTypes') },
	];

	const save = (next: typeof config) => {
		setConfig(next);
		setAlertConfig(spaceId, next);
	};

	return (
		<>
			<Label className="section" text={t('alertSection')} />
			<Label className="description" text={t('alertHint')} />

			<div className="actionItems">
				<div className="item">
					<Label text={t('alertModeLabel')} />
					<Select
						id="plusAlertMode"
						value={config.mode}
						options={modes}
						onChange={(v: string) => save({ ...config, mode: v as PlusAlertMode })}
						arrowClassName="black"
						menuParam={{ horizontal: I.MenuDirection.Right }}
					/>
				</div>

				{(config.mode == 'types') ? (
					<div className="item">
						<Label text={t('alertTypes')} />
						<Select
							id="plusAlertTypes"
							value={config.types}
							options={types.map(it => ({ id: it.id, name: it.name }))}
							isMultiple={true}
							onChange={(v: string[]) => save({ ...config, types: v })}
							arrowClassName="black"
							menuParam={{ horizontal: I.MenuDirection.Right }}
						/>
					</div>
				) : ''}
			</div>

			<div className="actionItems">
				<div className="item">
					<Label text={t('inboxTitle')} />
					<Button text={t('inboxOpen')} color="blank" size={28} onClick={openRecent} />
				</div>
			</div>
		</>
	);

});

export default PlusChangeAlertsSettings;
