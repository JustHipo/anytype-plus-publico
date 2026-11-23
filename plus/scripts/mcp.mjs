#!/usr/bin/env node
// plus: llama una herramienta del MCP oficial de Anytype (@anyproto/anytype-mcp) tal como lo hace Claude,
// para probar el camino completo MCP → API local → Anytype Plus. Usa la configuración del MCP `anytype`
// de ~/.claude.json (la key nunca se imprime).
//
// Uso:  node plus/scripts/mcp.mjs --list
//       node plus/scripts/mcp.mjs --schema API-create-object
//       node plus/scripts/mcp.mjs API-list-spaces '{}'
//       node plus/scripts/mcp.mjs API-create-object @archivo.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const find = (d) => {
	if (!d || typeof d !== 'object') return null;
	for (const [ k, v ] of Object.entries(d)) {
		if ((k === 'anytype') && v && v.env && v.env.OPENAPI_MCP_HEADERS) return v;
		const r = find(v);
		if (r) return r;
	};
	return null;
};

const cfg = find(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8')));
if (!cfg) { console.error('No encontré el MCP "anytype" en ~/.claude.json'); process.exit(1); }

const [ , , tool, argText ] = process.argv;
const args = (!argText || (tool === '--schema')) ? {} : JSON.parse(argText.startsWith('@') ? fs.readFileSync(argText.slice(1), 'utf8') : argText);

const child = spawn(cfg.command || 'npx', cfg.args || [ '-y', '@anyproto/anytype-mcp' ], { env: { ...process.env, ...cfg.env }, stdio: [ 'pipe', 'pipe', 'ignore' ] });
let buf = '';
let id = 0;
const pending = new Map();
const send = (method, params) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); });

child.stdout.on('data', (chunk) => {
	buf += chunk.toString();
	let nl;
	while ((nl = buf.indexOf('\n')) >= 0) {
		const line = buf.slice(0, nl).trim();
		buf = buf.slice(nl + 1);
		if (!line) continue;
		try { const msg = JSON.parse(line); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } } catch (e) { /**/ };
	};
});

const timer = setTimeout(() => { console.error('timeout'); child.kill(); process.exit(1); }, 60000);

await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'anytype-plus-test', version: '1' } });
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

if (tool === '--list') {
	const res = await send('tools/list', {});
	console.log((res.result?.tools || []).map(t => t.name).join('\n'));
} else if (tool === '--schema') {
	const res = await send('tools/list', {});
	const found = (res.result?.tools || []).find(t => t.name === argText);
	console.log(JSON.stringify(found?.inputSchema || null).slice(0, Number(process.env.MAXC || 3000)));
} else {
	const res = await send('tools/call', { name: tool, arguments: args });
	const text = (res.result?.content || []).map(c => c.text || '').join('\n');
	console.log(res.error ? 'ERROR ' + JSON.stringify(res.error) : (res.result?.isError ? 'ERROR ' : '') + text.slice(0, Number(process.env.MAXC || 3000)));
};

clearTimeout(timer);
child.kill();
process.exit(0);
