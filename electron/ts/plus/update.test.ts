// plus: el actualizador de Anytype y el de Anytype Plus comparten el mismo `autoUpdater`.
// Estas pruebas arrancan los dos como lo hace main.ts y miran qué pasa con cada respuesta del diálogo.
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const { EventEmitter } = require('events');

	class FakeUpdater extends EventEmitter {
		logger: any = null;
		autoDownload = true;
		autoInstallOnAppQuit = false;
		allowDowngrade = false;
		channel = '';
		downloadUpdate = vi.fn(async () => []);
		checkForUpdates = vi.fn(async () => null);
		checkForUpdatesAndNotify = vi.fn(async () => null);
		setFeedURL = vi.fn();
		quitAndInstall = vi.fn();
	};

	return {
		updater: new FakeUpdater(),
		dialogAnswer: { value: 1 },
		dialogs: [] as any[],
		keytar: {
			getPassword: vi.fn(async () => 'token-de-prueba'),
			setPassword: vi.fn(async () => {}),
			deletePassword: vi.fn(async () => true),
		},
		send: vi.fn(),
		setProgressBar: vi.fn(),
	};
});

vi.mock('electron-updater', () => ({ autoUpdater: mocks.updater }));
vi.mock('electron', () => ({
	app: { getVersion: () => '0.57.703', getLocale: () => 'es', isPackaged: true, on: vi.fn() },
	dialog: {
		showMessageBoxSync: vi.fn((_win: any, opts: any) => { mocks.dialogs.push(opts); return mocks.dialogAnswer.value; }),
		showMessageBox: vi.fn(async () => ({ response: 0 })),
	},
	shell: { openExternal: vi.fn() },
	BrowserWindow: class {},
}));
vi.mock('electron-util', () => ({ is: { macos: true, windows: false, linux: false, development: false } }));
vi.mock('keytar', () => ({ default: mocks.keytar }));
vi.mock('../config', () => ({ default: { config: { channel: 'latest', interfaceLang: 'es-ES', plusLastVersion: '0.57.703' }, set: vi.fn() } }));
vi.mock('../util', () => ({ default: { log: vi.fn(), send: mocks.send, getLogger: () => ({ transports: { file: {} } }) } }));

import UpdateManager from '../update';
import PlusUpdate from './update';

const win = { setProgressBar: mocks.setProgressBar, isDestroyed: () => false } as any;
const info = { version: '0.57.704', releaseNotes: '- Una novedad' } as any;
const flush = () => new Promise(r => setTimeout(r, 0));

const fetchStatus = (status: number) => {
	(globalThis as any).fetch = vi.fn(async () => ({ status, ok: (status >= 200) && (status < 300), json: async () => ({}) }));
};

beforeEach(async () => {
	vi.useFakeTimers({ toFake: [ 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval' ] });

	mocks.updater.removeAllListeners();
	mocks.updater.downloadUpdate.mockClear();
	mocks.keytar.deletePassword.mockClear();
	mocks.send.mockClear();
	mocks.dialogs.length = 0;

	if (PlusUpdate.timer) {
		clearInterval(PlusUpdate.timer);
	};

	PlusUpdate.isChecking = false;
	PlusUpdate.isDownloading = false;
	PlusUpdate.manual = false;

	// El mismo orden que main.ts
	UpdateManager.setWindow(win);
	UpdateManager.init();
	await PlusUpdate.init(win);

	vi.useRealTimers();
});

describe('diálogo de versión nueva', () => {

	test('«Más tarde» no descarga nada', () => {
		mocks.dialogAnswer.value = 1;
		mocks.updater.emit('update-available', info);

		expect(mocks.dialogs.length).toBe(1);
		expect(mocks.updater.downloadUpdate).not.toHaveBeenCalled();
	});

	test('«Actualizar ahora» descarga una sola vez', () => {
		mocks.dialogAnswer.value = 0;
		mocks.updater.emit('update-available', info);

		expect(mocks.updater.downloadUpdate).toHaveBeenCalledTimes(1);
	});

	test('la ventana de Anytype no recibe los avisos de su propio actualizador', () => {
		mocks.dialogAnswer.value = 1;
		mocks.updater.emit('update-available', info);
		mocks.updater.emit('update-downloaded', info);

		const channels = mocks.send.mock.calls.map(it => it[1]);

		expect(channels).not.toContain('download-started');
		expect(channels).not.toContain('update-downloaded');
	});

});

describe('errores al buscar', () => {

	const notFound = new Error('Cannot find latest-mac.yml in the latest release artifacts (https://api.github.com/x): HttpError: 404');

	test('un 404 con el token todavía válido no desconecta', async () => {
		fetchStatus(200);
		await PlusUpdate.onError(notFound);
		await flush();

		expect(PlusUpdate.isConnected()).toBe(true);
		expect(mocks.keytar.deletePassword).not.toHaveBeenCalled();
	});

	test('sin acceso al repo (404 al consultarlo) conserva el token', async () => {
		fetchStatus(404);
		await PlusUpdate.onError(notFound);
		await flush();

		expect(PlusUpdate.isConnected()).toBe(true);
		expect(mocks.keytar.deletePassword).not.toHaveBeenCalled();
	});

	test('sin red conserva el token', async () => {
		(globalThis as any).fetch = vi.fn(async () => { throw new Error('ENOTFOUND'); });
		await PlusUpdate.onError(notFound);
		await flush();

		expect(PlusUpdate.isConnected()).toBe(true);
	});

	test('token rechazado por GitHub (401) desconecta', async () => {
		fetchStatus(401);
		await PlusUpdate.onError(new Error('HttpError: 401 Bad credentials'));
		await flush();

		expect(PlusUpdate.isConnected()).toBe(false);
		expect(mocks.keytar.deletePassword).toHaveBeenCalledTimes(1);
	});

});
