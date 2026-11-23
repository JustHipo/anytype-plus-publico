#!/usr/bin/env node
// plus: prueba el sanitizador del modo nativo dentro del Chromium de la app (DOM y DOMPurify reales).
// Requiere el fork corriendo en modo desarrollo con: electron . --remote-debugging-port=9333
const PORT = process.env.PLUS_DEBUG_PORT || 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const target = list.find(x => x.url.includes('index.html'));
const ws = new WebSocket(target.webSocketDebuggerUrl);

const code = `(async () => {
	const { parseHtml } = await import('/src/ts/plus/htmlParse.ts?t=' + Date.now());
	const out = [];
	const check = (name, ok, detail) => out.push({ name, ok: !!ok, detail: ok ? undefined : detail });

	const evil = parseHtml([
		'<script>window.__plusPwned = 1</scr' + 'ipt>',
		'<img src="x" onerror="window.__plusPwned = 1">',
		'<a href="javascript:window.__plusPwned=1">a</a>',
		'<iframe src="https://example.com"></iframe>',
		'<form action="https://example.com"><input name="q"></form>',
		'<object data="x"></object><embed src="x">',
		'<meta http-equiv="refresh" content="0;url=https://example.com">',
		'<base href="https://example.com/">',
		'<svg><script>window.__plusPwned = 1</scr' + 'ipt><a xlink:href="javascript:1">x</a></svg>',
		'<div onclick="window.__plusPwned = 1">d</div>',
		'<math><mtext><table><mglyph><style><img src=x onerror="window.__plusPwned=1">',
		'<anytype-view object="s" onclick="window.__plusPwned = 1"></anytype-view>',
	].join(''));

	check('sin script', !/<script/i.test(evil.html), evil.html);
	check('sin manejadores on*', !/\\son[a-z]+=/i.test(evil.html), evil.html);
	check('sin javascript:', !/javascript:/i.test(evil.html), evil.html);
	check('sin iframe/form/object/embed/meta/base', !/<iframe|<form|<object|<embed|<meta|<base/i.test(evil.html), evil.html);

	// Al insertarlo de verdad en un shadow root no debe ejecutarse nada
	const host = document.createElement('div');
	document.body.appendChild(host);
	host.attachShadow({ mode: 'open' }).innerHTML = evil.html;
	await new Promise(r => setTimeout(r, 300));
	check('nada se ejecuta al insertarlo', window.__plusPwned === undefined, 'se ejecutó código');
	host.remove();

	const css = parseHtml('<html><head><style>h1 { color: red; }</style></head><body class="a" style="margin:0"><h1>T</h1><style>p { margin: 0; }</style></body></html>');
	check('separa estilos', css.css.length == 2 && !/<style/.test(css.html) && css.bodyClass == 'a' && css.bodyStyle == 'margin:0', JSON.stringify(css));

	const links = parseHtml('<a href="anytype://object?objectId=abc&spaceId=s.1">o</a><a href="https://anytype.io">w</a><img src="anytype://file/f1">');
	check('conserva enlaces web y de Anytype', links.html.includes('anytype://object?objectId=abc') && links.html.includes('https://anytype.io') && links.html.includes('anytype://file/f1'), links.html);

	const slots = parseHtml('<section><anytype-view object="set1" view="Kanban"></anytype-view><p>x</p><anytype-object object="o1" as="card"></anytype-object></section>');
	check('etiquetas nativas pasan a slots', slots.slots.length == 2 && slots.slots[0].attrs.object == 'set1' && slots.slots[0].attrs.view == 'Kanban' && slots.slots[1].attrs.as == 'card' && slots.html.includes('<slot name="' + slots.slots[0].name + '">'), JSON.stringify(slots));
	check('la etiqueta nativa no conserva manejadores', evil.slots.every(s => !Object.keys(s.attrs).some(k => k.startsWith('on'))), JSON.stringify(evil.slots));

	const fold = parseHtml('<anytype-folders/onmouseover=alert(1) key="ruta_repo" root="docs" onclick="x()" data-k="1"></anytype-folders><anytype-list source="s" filter="a = 1" onfocus="y()"><b>{{name}}</b></anytype-list>');
	const attrs = fold.lists.map(l => Object.keys(l.attrs)).flat();
	check('anytype-folders y anytype-list solo con atributos permitidos', !attrs.some(k => k.startsWith('on')) && !/\son[a-z]+=/i.test(fold.html) && fold.lists[0]?.attrs.root == 'docs' && fold.lists[1]?.attrs.filter == 'a = 1', JSON.stringify({ attrs, html: fold.html }));

	const kept = parseHtml('<details><summary>s</summary><input type="checkbox" id="t"><label for="t">l</label><table><tr><td style="color:red" class="c">x</td></tr></table></details>');
	check('conserva details, input, label, tablas, style y class', /<details>/.test(kept.html) && /<input/.test(kept.html) && /<label/.test(kept.html) && /style="color:red"/.test(kept.html) && /class="c"/.test(kept.html), kept.html);

	return out;
})()`;

ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, awaitPromise: true, returnByValue: true } }));
ws.onmessage = (m) => {
	const d = JSON.parse(m.data);
	if (d.id !== 1) return;
	const res = d.result.result?.value;
	if (!Array.isArray(res)) { console.log('ERROR', JSON.stringify(d.result).slice(0, 800)); process.exit(1); }
	let fail = 0;
	for (const r of res) { console.log((r.ok ? 'OK   ' : 'FALLA') + ' ' + r.name + (r.ok ? '' : '\n      ' + String(r.detail).slice(0, 400))); if (!r.ok) fail++; }
	console.log(fail ? `\n${fail} fallas` : `\n${res.length} pruebas OK`);
	process.exit(fail ? 1 : 0);
};
setTimeout(() => { console.log('timeout'); process.exit(1); }, 20000);
