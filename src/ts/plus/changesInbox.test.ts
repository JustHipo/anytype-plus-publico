import { describe, it, expect } from 'vitest';
import { PlusChange, emptyState, normalizeState, isUnread, inboxChanges, countUnread, groupChanges, markSeen, markAllSeen } from './changesInbox';

const change = (id: string, date: number, whoId = 'ana', spaceId = 'sp'): PlusChange => ({
	id, spaceId, name: `Doc ${id}`, typeId: 't', typeName: 'Documento', who: whoId, whoId, layout: 0, date,
});

describe('bandeja de cambios', () => {
	it('lo anterior a «visto hasta» no entra; lo posterior entra sin ver', () => {
		const state = { seenUntil: 100, seen: {} };
		const list = inboxChanges([ change('a', 90), change('b', 120), change('c', 110) ], state);
		expect(list.map(it => it.id)).toEqual([ 'b', 'c' ]);
		expect(countUnread(list, state)).toBe(2);
	});

	it('un objeto abierto queda visto hasta que alguien lo vuelve a cambiar', () => {
		let state = emptyState();
		state = markSeen(state, change('a', 120));
		expect(isUnread(change('a', 120), state)).toBe(false);
		expect(isUnread(change('a', 130), state)).toBe(true);
	});

	it('marcar todo usa la fecha del cambio más nuevo, no la hora local', () => {
		const state = markAllSeen({ seenUntil: 10, seen: { a: 50, b: 300 } }, [ change('a', 50), change('c', 200) ]);
		expect(state.seenUntil).toBe(200);
		// lo visto antes de esa fecha se limpia; lo posterior se conserva
		expect(state.seen).toEqual({ b: 300 });
	});

	it('30 cambios en ráfaga de la misma persona son una sola entrada', () => {
		const list = Array.from({ length: 30 }, (_, i) => change(`d${i}`, 1000 - (i * 2)));
		const groups = groupChanges(list, () => emptyState());
		expect(groups).toHaveLength(1);
		expect(groups[0].changes).toHaveLength(30);
		expect(groups[0].unread).toBe(30);
	});

	it('se corta por persona, por espacio y por pausa', () => {
		const list = [
			change('a', 1000, 'ana'),
			change('b', 995, 'ana'),
			change('c', 990, 'beto'),
			change('d', 985, 'ana'),
			change('e', 900, 'ana'),
			change('f', 899, 'ana', 'otro'),
		];
		const groups = groupChanges(list, () => emptyState());
		expect(groups.map(g => g.changes.map(it => it.id).join(''))).toEqual([ 'ab', 'c', 'd', 'e', 'f' ]);
	});

	it('el estado guardado se limpia al leerlo', () => {
		expect(normalizeState(null)).toEqual({ seenUntil: 0, seen: {} });
		expect(normalizeState({ seenUntil: '100', seen: { a: 90, b: '150', '': 200 } })).toEqual({ seenUntil: 100, seen: { b: 150 } });
	});
});

describe('<anytype-changes>', () => {
	it('llena la plantilla por defecto y escapa los valores', async () => {
		const { renderChangeRow } = await import('./changesInbox');
		const html = renderChangeRow('', { url: 'anytype://object?objectId=a&spaceId=s', icon: '📄', name: '<b>x</b>', who: 'Ana', when: 'hace 3 min', unread: 'unread' });
		expect(html).toBe('<a class="row unread" href="anytype://object?objectId=a&amp;spaceId=s"><span class="e">📄</span><span class="t">&lt;b&gt;x&lt;/b&gt;</span><span class="m">Ana · hace 3 min</span></a>');
	});
});
