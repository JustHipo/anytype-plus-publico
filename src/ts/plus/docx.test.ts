import { describe, it, expect, vi } from 'vitest';

vi.mock('docx-preview', () => ({ renderAsync: vi.fn() }));
vi.mock('Component', () => ({ Loader: () => null }));

import { fixSymbols, isDocxObject } from './docxViewer';

describe('fixSymbols', () => {
	it('cambia viñetas de Symbol por Unicode, en texto y en CSS', () => {
		expect(fixSymbols(' punto')).toBe('• punto');
		expect(fixSymbols('content: "\\f0b7"')).toBe('content: "•"');
		expect(fixSymbols('')).toBe('▪');
		expect(fixSymbols('texto normal')).toBe('texto normal');
	});
});

describe('isDocxObject', () => {
	it('reconoce por extensión o por tipo', () => {
		expect(isDocxObject({ fileExt: 'docx', fileMimeType: 'application/zip' })).toBe(true);
		expect(isDocxObject({ fileExt: '.DOCX' })).toBe(true);
		expect(isDocxObject({ fileMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(true);
		expect(isDocxObject({ fileExt: 'pdf', fileMimeType: 'application/pdf' })).toBe(false);
		expect(isDocxObject({ fileExt: 'doc' })).toBe(false);
	});
});
