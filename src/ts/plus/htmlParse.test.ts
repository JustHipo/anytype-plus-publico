import { describe, it, expect } from 'vitest';
import { hasExecutableCode, scopeSelector } from './htmlParse';

describe('plus/htmlParse', () => {

	describe('hasExecutableCode', () => {
		it('detecta scripts, manejadores y javascript:', () => {
			expect(hasExecutableCode('<div><script>alert(1)</script></div>')).toBe(true);
			expect(hasExecutableCode('<SCRIPT src="x.js"></SCRIPT>')).toBe(true);
			expect(hasExecutableCode('<img src="a.png" onerror="x()">')).toBe(true);
			expect(hasExecutableCode('<a href="javascript:alert(1)">x</a>')).toBe(true);
		});

		it('no confunde texto normal con código', () => {
			expect(hasExecutableCode('<p>La onda = buena, sin script alguno</p>')).toBe(false);
			expect(hasExecutableCode('<div class="plus-card"><h2>Hola</h2></div>')).toBe(false);
		});
	});

	// parseHtml necesita un DOM real y el sanitizador real: se prueba dentro de la app con
	// plus/scripts/probar-sanitizador.mjs (los tests de vitest corren en node con DOMPurify simulado).

	describe('scopeSelector', () => {
		it('lleva html, :root y body al contenedor', () => {
			expect(scopeSelector(':root')).toBe(':host');
			expect(scopeSelector('html')).toBe(':host');
			expect(scopeSelector('body')).toBe('.plus-body');
			expect(scopeSelector('html body .card')).toBe(':host .plus-body .card');
			expect(scopeSelector('body.dark .card, :root .x')).toBe('.plus-body.dark .card, :host .x');
			expect(scopeSelector('html.dark body')).toBe(':host(.dark) .plus-body');
		});

		it('no toca selectores que solo contienen esas palabras', () => {
			expect(scopeSelector('.body-text')).toBe('.body-text');
			expect(scopeSelector('.card tbody td')).toBe('.card tbody td');
			expect(scopeSelector('#html-box')).toBe('#html-box');
		});
	});

});

describe('plus/links', async () => {
	const { normalizeObjectLink } = await import('./links');
	const SPACE = 'bafyreigudj5ygtwzfkofo.3fjd8kxha2ph1';

	it('completa el espacio cuando falta o es el id corto de la API', () => {
		expect(normalizeObjectLink('anytype://object?objectId=abc', SPACE)).toBe(`anytype://object?objectId=abc&spaceId=${encodeURIComponent(SPACE)}`);
		expect(normalizeObjectLink('anytype://object?objectId=abc&spaceId=qqtzya', SPACE)).toBe(`anytype://object?objectId=abc&spaceId=${encodeURIComponent(SPACE)}`);
	});

	it('respeta un espacio interno y los enlaces que no son de objetos', () => {
		const other = 'anytype://object?objectId=abc&spaceId=bafyotro.clave';
		expect(normalizeObjectLink(other, SPACE)).toBe(other);
		expect(normalizeObjectLink('https://anytype.io', SPACE)).toBe('https://anytype.io');
	});
});
