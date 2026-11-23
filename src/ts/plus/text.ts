// plus: textos de la interfaz propios de Anytype Plus, en español e inglés.
// Anytype guarda sus textos en src/json/text.json, que viene del proyecto original; los nuestros van aquí
// para no chocar al actualizar. Se muestra español si la app está en español; si no, inglés.

const TEXT: Record<string, { es: string; en: string }> = {
	langName: { es: 'HTML en vivo', en: 'Live HTML' },
	menuHtml: { es: 'HTML', en: 'HTML' },
	showCode: { es: 'Ver código', en: 'Show code' },
	hideCode: { es: 'Ocultar código', en: 'Hide code' },
	autoHeight: { es: 'Alto automático', en: 'Auto height' },
	resizeAuto: { es: 'Arrastra para fijar el alto', en: 'Drag to set the height' },
	resizeFixed: { es: 'Arrastra para cambiar el alto · doble clic: alto automático', en: 'Drag to change the height · double click: auto height' },
	viewMissingAttr: { es: 'Falta el atributo object en <anytype-view>', en: 'Missing object attribute in <anytype-view>' },
	viewCreateError: { es: 'No se pudo crear la vista', en: 'Could not create the view' },
	viewNoViews: { es: 'Este objeto no tiene vistas (debe ser un set, una colección o un tipo)', en: 'This object has no views (it must be a set, a collection or a type)' },
	viewReadonly: { es: 'Esta vista todavía no existe en la página (la crea quien pueda editarla)', en: 'This view does not exist in the page yet (someone who can edit creates it)' },
	objectMissingAttr: { es: 'Falta el atributo object en <anytype-object>', en: 'Missing object attribute in <anytype-object>' },
	objectMissing: { es: 'Objeto no disponible', en: 'Object not available' },
	tagNotReady: { es: 'todavía no está disponible', en: 'is not available yet' },
	copyForHtml: { es: 'Copiar para HTML', en: 'Copy for HTML' },
	copiedForHtml: { es: 'Etiqueta copiada: pégala en tu HTML', en: 'Tag copied: paste it into your HTML' },
	editPage: { es: 'Editar HTML', en: 'Edit HTML' },
	viewPage: { es: 'Ver página', en: 'View page' },
	listError: { es: 'Lista no disponible: source debe ser un tipo, una colección o un set', en: 'List not available: source must be a type, a collection or a set' },
	palette: { es: 'Paleta de colores', en: 'Color palette' },
	textSize: { es: 'Tamaño del texto', en: 'Text size' },
	pageDefault: { es: 'Predeterminado', en: 'Default' },
	pageFont: { es: 'Fuente de la página', en: 'Page font' },
	pageTextSize: { es: 'Tamaño del texto de la página', en: 'Page text size' },
	blockStyle: { es: 'Marco', en: 'Frame' },
	styleNone: { es: 'Ninguno', en: 'None' },
	styleCard: { es: 'Tarjeta', en: 'Card' },
	styleAccent: { es: 'Tarjeta con acento', en: 'Accent card' },
	embedCycle: { es: 'Este objeto ya está incrustado más arriba', en: 'This object is already embedded above' },
	embedOpen: { es: 'Abrir', en: 'Open' },
	embedFull: { es: 'Mostrar completo', en: 'Show in full' },
	embedAsLink: { es: 'Mostrar como enlace', en: 'Show as link' },
	docxError: { es: 'No se pudo abrir este documento de Word', en: 'Could not open this Word document' },
	alertSomeone: { es: 'Alguien', en: 'Someone' },
	alertTitle: { es: '«%s» cambió', en: '“%s” changed' },
	alertGroupTitle: { es: '%s cambió %s objetos', en: '%s changed %s objects' },
	alertSection: { es: 'Avisos de cambios en este espacio', en: 'Change alerts in this space' },
	alertModeLabel: { es: 'Avisar de', en: 'Alert me about' },
	alertModeOff: { es: 'Desactivados', en: 'Off' },
	alertModeAll: { es: 'Todo el espacio', en: 'Whole space' },
	alertModeTypes: { es: 'Solo tipos elegidos', en: 'Chosen types only' },
	alertTypes: { es: 'Tipos', en: 'Types' },
	alertHint: { es: 'Avisa cuando otra persona edita un objeto, con la app abierta. La bandeja «Cambios» de la barra lateral guarda todo, también lo que cambió con la app cerrada.', en: 'Alerts you when someone else edits an object, while the app is open. The “Changes” inbox in the sidebar keeps everything, also what changed while the app was closed.' },
	inboxTitle: { es: 'Cambios', en: 'Changes' },
	inboxOpen: { es: 'Abrir la bandeja de cambios', en: 'Open the changes inbox' },
	inboxSummary: { es: '%s cambios desde tu última visita', en: '%s changes since your last visit' },
	inboxMarkAll: { es: 'Marcar todo como visto', en: 'Mark all as seen' },
	inboxEmpty: { es: 'Nada nuevo desde %s', en: 'Nothing new since %s' },
	inboxEmptyNever: { es: 'Nada nuevo por ahora', en: 'Nothing new yet' },
	inboxOne: { es: '1 cambio', en: '1 change' },
	inboxMany: { es: '%s cambios', en: '%s changes' },
	inboxThisSpace: { es: 'Este canal', en: 'This space' },
	inboxAllSpaces: { es: 'Todos los canales', en: 'All spaces' },
	inboxAllTypes: { es: 'Todos los tipos', en: 'All types' },
	agoNow: { es: 'ahora', en: 'now' },
	agoMin: { es: 'hace %s min', en: '%s min ago' },
	agoHour: { es: 'hace %s h', en: '%s h ago' },
	todayAt: { es: 'hoy a las %s', en: 'today at %s' },
	yesterdayAt: { es: 'ayer a las %s', en: 'yesterday at %s' },
	dateAt: { es: 'el %s a las %s', en: '%s at %s' },
	emptyHtml: { es: 'HTML vacío. Usa «Ver código» para escribirlo.', en: 'Empty HTML. Use “Show code” to write it.' },
};

export const t = (key: string): string => {
	const item = TEXT[key];
	if (!item) {
		return key;
	};

	const lang = String(S.Common.interfaceLang || '').toLowerCase();

	return lang.startsWith('es') ? item.es : item.en;
};
