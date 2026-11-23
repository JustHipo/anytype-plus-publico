// plus: enlaces a objetos escritos dentro de un HTML.
// La app necesita el id interno del espacio (bafy…) para abrir `anytype://object?objectId=…`. Si el enlace no
// lo trae, o trae el id corto de la API v2 (por ejemplo «qqtzya»), se usa el espacio actual.

export const normalizeObjectLink = (href: string, spaceId: string): string => {
	const s = String(href || '');

	if (!/^anytype:\/\/object\?/i.test(s) || !spaceId) {
		return s;
	};

	try {
		const url = new URL(s);
		const current = url.searchParams.get('spaceId') || '';

		// Un id interno de espacio tiene la forma <cid>.<clave>; el corto de la API no
		if (!current || !current.includes('.')) {
			url.searchParams.set('spaceId', spaceId);
		};

		return url.toString();
	} catch (e) {
		return s;
	};
};
