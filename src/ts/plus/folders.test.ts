import { describe, it, expect, vi } from 'vitest';

vi.mock('Interface', () => ({ FilterCondition: {}, RelationType: {}, ObjectLayout: {} }));

import { splitPath, buildTree, renderTree } from './foldersRender';

const item = (id: string, path: string, name = id) => ({ id, name, path });

describe('splitPath', () => {
	it('separa carpetas y archivo', () => {
		expect(splitPath('docs/contexto/A.md')).toEqual({ dirs: [ 'docs', 'contexto' ], file: 'A.md' });
	});

	it('quita anclas, ./ y ../', () => {
		expect(splitPath('docs/contexto/NOTAS.md §1')).toEqual({ dirs: [ 'docs', 'contexto' ], file: 'NOTAS.md' });
		expect(splitPath('docs/a.md#seccion')).toEqual({ dirs: [ 'docs' ], file: 'a.md' });
		expect(splitPath('../Docs del equipo/Empresa/x.html')).toEqual({ dirs: [ 'Docs del equipo', 'Empresa' ], file: 'x.html' });
		expect(splitPath('./a//b/c.md')).toEqual({ dirs: [ 'a', 'b' ], file: 'c.md' });
	});

	it('archivo en la raíz', () => {
		expect(splitPath('README.md')).toEqual({ dirs: [], file: 'README.md' });
	});
});

describe('buildTree', () => {
	const items = [
		item('1', 'README.md', 'Léeme'),
		item('2', 'docs/contexto/A.md', 'Alfa'),
		item('3', 'docs/contexto/B.md', 'Beta'),
		item('4', 'docs/prompts/P10.md', 'Prompt 10'),
		item('5', 'docs/prompts/P2.md', 'Prompt 2'),
		item('6', 'centro/documentacion/empresa/C-01.md', 'C-01'),
	];

	it('cuenta y ordena carpetas y archivos', () => {
		const tree = buildTree(items);

		expect(tree.count).toBe(6);
		expect(tree.files.map(it => it.id)).toEqual([ '1' ]);
		expect(tree.dirs.map(it => it.name)).toEqual([ 'centro/documentacion/empresa', 'docs' ]);

		const docs = tree.dirs[1];
		expect(docs.count).toBe(4);
		expect(docs.dirs.map(it => it.name)).toEqual([ 'contexto', 'prompts' ]);
		// Orden numérico: «Prompt 2» antes que «Prompt 10»
		expect(docs.dirs[1].files.map(it => it.name)).toEqual([ 'Prompt 2', 'Prompt 10' ]);
	});

	it('root muestra solo lo que está bajo esa carpeta', () => {
		const tree = buildTree(items, 'docs/');

		expect(tree.count).toBe(4);
		expect(tree.files).toEqual([]);
		expect(tree.dirs.map(it => it.name)).toEqual([ 'contexto', 'prompts' ]);
	});

	it('root que no coincide deja el árbol vacío', () => {
		expect(buildTree(items, 'nada').count).toBe(0);
	});
});

describe('renderTree', () => {
	it('escapa textos y arma enlaces y carpetas', () => {
		const tree = buildTree([ item('x1', 'a/<b>.md', 'Nombre "raro" & <script>') ]);
		const html = renderTree(tree, 'esp', 1);

		expect(html).toContain('<details class="plus-folders-dir" data-path="a" open>');
		expect(html).toContain('href="anytype://object?objectId=x1&amp;spaceId=esp"');
		expect(html).toContain('Nombre &quot;raro&quot; &amp; &lt;script&gt;');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;b&gt;.md');
	});

	it('open=0 deja todo cerrado', () => {
		const html = renderTree(buildTree([ item('1', 'a/b/c.md'), item('2', 'a/d.md') ]), 'esp', 0);

		expect(html).not.toContain(' open>');
		expect(html).toContain('data-path="a/b"');
	});
});
