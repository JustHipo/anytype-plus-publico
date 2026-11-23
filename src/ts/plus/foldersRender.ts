// plus: funciones puras de <anytype-folders> (árbol de carpetas armado con la ruta de cada objeto), para
// poder probarlas con vitest. Las carpetas no existen como objetos: salen de la ruta (`ruta_repo`).

import { escapeHtml } from './listRender';

export interface PlusFolderItem {
	id: string;
	name: string;
	path: string;
	icon?: string;
};

export interface PlusFolderNode {
	name: string;
	dirs: PlusFolderNode[];
	files: PlusFolderItem[];
	count: number;
};

/**
 * Ruta → partes de carpeta. Quita lo que no es carpeta: el ancla (`archivo.md §1`, `archivo.md#seccion`),
 * los `./` y `../` del comienzo y las barras repetidas. Devuelve las carpetas y el nombre del archivo.
 */
export const splitPath = (path: string): { dirs: string[]; file: string } => {
	let p = String(path || '').trim();

	p = p.split(/\s+§|#/)[0].trim();
	p = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');

	const parts = p.split('/').filter(it => it && (it != '.') && (it != '..'));
	const file = parts.pop() || '';

	return { dirs: parts, file };
};

/**
 * Arma el árbol. `root` limita a lo que está bajo esa carpeta (y la quita de las rutas). Carpetas primero y en
 * orden alfabético; los objetos, por nombre. Una carpeta que solo contiene otra carpeta se junta con ella
 * («a/b»), como el explorador de archivos de VS Code.
 */
export const buildTree = (items: PlusFolderItem[], root?: string): PlusFolderNode => {
	const top: PlusFolderNode = { name: '', dirs: [], files: [], count: 0 };
	const rootParts = splitPath(`${String(root || '').replace(/\/+$/, '')}/x`).dirs;

	for (const item of items) {
		let { dirs } = splitPath(item.path);

		if (rootParts.length) {
			if (rootParts.some((part, i) => dirs[i] != part)) {
				continue;
			};
			dirs = dirs.slice(rootParts.length);
		};

		let node = top;
		for (const dir of dirs) {
			let next = node.dirs.find(it => it.name == dir);
			if (!next) {
				next = { name: dir, dirs: [], files: [], count: 0 };
				node.dirs.push(next);
			};
			node = next;
		};

		node.files.push(item);
	};

	const finish = (node: PlusFolderNode): number => {
		node.dirs.forEach(finish);

		node.dirs = node.dirs.map(dir => {
			while (!dir.files.length && (dir.dirs.length == 1)) {
				const only = dir.dirs[0];
				dir = { ...only, name: `${dir.name}/${only.name}` };
			};
			return dir;
		});

		node.dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
		node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
		node.count = node.files.length + node.dirs.reduce((sum, it) => sum + it.count, 0);

		return node.count;
	};

	finish(top);
	return top;
};

/**
 * HTML del árbol. Cada carpeta es un `<details>` (se pliega sin JavaScript); las de los primeros `openDepth`
 * niveles empiezan abiertas. Cada objeto es un enlace que Anytype abre. Todo texto va escapado.
 */
export const renderTree = (node: PlusFolderNode, spaceId: string, openDepth: number, depth = 0, prefix = ''): string => {
	const dirs = node.dirs.map(dir => {
		const open = (depth < openDepth) ? ' open' : '';
		const path = prefix ? `${prefix}/${dir.name}` : dir.name;

		return [
			`<details class="plus-folders-dir" data-path="${escapeHtml(path)}"${open}>`,
			`<summary><span class="plus-folders-name">${escapeHtml(dir.name)}</span><span class="plus-folders-count">${dir.count}</span></summary>`,
			`<div class="plus-folders-children">${renderTree(dir, spaceId, openDepth, depth + 1, path)}</div>`,
			'</details>',
		].join('');
	});

	const files = node.files.map(item => {
		const url = `anytype://object?objectId=${item.id}&spaceId=${spaceId}`;
		const icon = item.icon ? `<span class="plus-folders-icon">${escapeHtml(item.icon)}</span>` : '';
		const file = splitPath(item.path).file;

		return [
			`<a class="plus-folders-file" href="${escapeHtml(url)}" title="${escapeHtml(item.path)}">`,
			icon,
			`<span class="plus-folders-name">${escapeHtml(item.name || file)}</span>`,
			`<span class="plus-folders-hint">${escapeHtml(file)}</span>`,
			'</a>',
		].join('');
	});

	return dirs.concat(files).join('');
};
