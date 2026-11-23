// plus: actualizaciones de Anytype Plus desde el repo privado de GitHub.
//
// - Cada persona conecta su cuenta de GitHub una vez (flujo «device»: abre una página de GitHub y escribe un
//   código). Se usa una GitHub App con permiso de solo lectura instalada solo en el repo, así que el permiso
//   sirve únicamente a quien colabora en el repo. No hay ningún token guardado dentro de la app.
// - El token de cada persona queda en el llavero del sistema.
// - Al abrir la app y cada cierto tiempo se buscan versiones nuevas en los Releases del repo. Si hay, se muestran
//   sus novedades con «Actualizar ahora»; la descarga y el reinicio los hace electron-updater.
// - Después de actualizar, la primera vez que se abre se muestran las novedades de esa versión.
//
// Configuración en package.json → "plusUpdate": { owner, repo, clientId }. Sin clientId, todo esto queda apagado.

import { app, clipboard, dialog, shell, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import keytar from 'keytar';
import ConfigManager from '../config';
import Util from '../util';

const pkg = require('../../../package.json');

const KEYTAR_SERVICE = 'Anytype Plus updates';
const KEYTAR_ACCOUNT = 'github';
const CHECK_EVERY = 4 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY = 20 * 1000;

interface PlusUpdateConfig {
	owner: string;
	repo: string;
	clientId: string;
};

const getConfig = (): PlusUpdateConfig => {
	const c = pkg.plusUpdate || {};
	return { owner: String(c.owner || ''), repo: String(c.repo || ''), clientId: String(c.clientId || '') };
};

/** Texto plano a partir de las notas del Release (markdown o HTML), para un diálogo nativo. */
const plainNotes = (notes: any): string => {
	let s = '';

	if (Array.isArray(notes)) {
		s = notes.map(it => `${it.version}\n${it.note || ''}`).join('\n\n');
	} else {
		s = String(notes || '');
	};

	return s
		.replace(/<li>/gi, '• ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
		.replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
		.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
		.replace(/\n{3,}/g, '\n\n').trim()
		.slice(0, 3000);
};

const isSpanish = (): boolean => /^es/i.test(String((ConfigManager.config as any).interfaceLang || app.getLocale() || ''));
const tx = (es: string, en: string): string => isSpanish() ? es : en;

class PlusUpdate {

	win: BrowserWindow | null = null;
	token = '';
	timer: ReturnType<typeof setInterval> | null = null;
	isChecking = false;
	isConnecting = false;
	pending: { code: string; uri: string } | null = null; // código de la conexión que espera autorización
	isDownloading = false;
	manual = false;
	onChange: (() => void) | null = null; // el menú se vuelve a armar al conectar o desconectar

	isEnabled (): boolean {
		const c = getConfig();
		return app.isPackaged && Boolean(c.owner && c.repo && c.clientId);
	};

	isConnected (): boolean {
		return Boolean(this.token);
	};

	async init (win: BrowserWindow) {
		this.win = win;

		if (!this.isEnabled()) {
			console.log('[PlusUpdate] desactivado (sin clientId o sin empaquetar)');
			return;
		};

		try {
			this.token = (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)) || '';
		} catch (e) {
			this.token = '';
		};

		autoUpdater.logger = Util.getLogger();
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = true;
		autoUpdater.allowDowngrade = false;
		autoUpdater.channel = 'latest';

		autoUpdater.on('update-available', (info: UpdateInfo) => this.onAvailable(info));
		autoUpdater.on('update-not-available', () => this.onNotAvailable());
		autoUpdater.on('update-downloaded', (info: UpdateInfo) => this.onDownloaded(info));
		autoUpdater.on('error', (err: Error) => this.onError(err));
		autoUpdater.on('download-progress', (progress: { percent: number }) => this.setProgress(Number(progress?.percent) / 100));

		this.showWhatsNew();

		setTimeout(() => this.check(false), FIRST_CHECK_DELAY);
		this.timer = setInterval(() => this.check(false), CHECK_EVERY);
	};

	setFeed () {
		const c = getConfig();

		autoUpdater.setFeedURL({ provider: 'github', owner: c.owner, repo: c.repo, private: true, token: this.token } as any);
	};

	/** Busca una versión nueva. `manual`: la pidió la persona desde el menú, así que siempre responde algo. */
	async check (manual: boolean) {
		if (!this.isEnabled() || this.isChecking || this.isDownloading) {
			return;
		};

		this.manual = manual;

		if (!this.token) {
			if (manual) {
				await this.connect();
			};
			return;
		};

		this.isChecking = true;
		this.setFeed();

		try {
			await autoUpdater.checkForUpdates();
		} catch (e) {
			this.onError(e as Error);
		};
	};

	onAvailable (info: UpdateInfo) {
		this.isChecking = false;

		const notes = plainNotes(info.releaseNotes);
		const res = dialog.showMessageBoxSync(this.win, {
			type: 'info',
			title: 'Anytype Plus',
			message: tx(`Hay una versión nueva: ${info.version}`, `A new version is available: ${info.version}`),
			detail: notes ? `${tx('Novedades', 'What\'s new')}:\n\n${notes}` : '',
			buttons: [ tx('Actualizar ahora', 'Update now'), tx('Más tarde', 'Later') ],
			defaultId: 0,
			cancelId: 1,
		});

		if (res == 0) {
			this.isDownloading = true;
			this.setProgress(0.01);
			autoUpdater.downloadUpdate().catch((e: Error) => this.onError(e));
		};
	};

	/** Avance de la descarga en el ícono de la app (Dock o barra de tareas). Menor que 0 lo quita. */
	setProgress (v: number) {
		try {
			if (this.win && !this.win.isDestroyed()) {
				this.win.setProgressBar(isNaN(v) ? -1 : v);
			};
		} catch (e) { /**/ };
	};

	/**
	 * Pregunta a GitHub si el token sigue sirviendo para el repo.
	 * `revoked`: GitHub rechazó el token. `noAccess`: el token vale pero la cuenta no ve el repo.
	 * `ok`: el token y el acceso están bien. `unknown`: no se pudo preguntar (sin red, GitHub caído).
	 */
	async checkAccess (): Promise<'ok' | 'revoked' | 'noAccess' | 'unknown'> {
		const c = getConfig();

		try {
			const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, {
				headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${this.token}` },
			});

			if (r.status == 401) {
				return 'revoked';
			};
			if (r.status == 404) {
				return 'noAccess';
			};
			return r.ok ? 'ok' : 'unknown';
		} catch (e) {
			return 'unknown';
		};
	};

	onNotAvailable () {
		this.isChecking = false;

		if (this.manual) {
			dialog.showMessageBoxSync(this.win, {
				type: 'info',
				title: 'Anytype Plus',
				message: tx('Tienes la última versión', 'You have the latest version'),
				detail: `Anytype Plus ${app.getVersion()}`,
			});
		};
	};

	onDownloaded (info: UpdateInfo) {
		this.isDownloading = false;
		this.setProgress(-1);

		const res = dialog.showMessageBoxSync(this.win, {
			type: 'info',
			title: 'Anytype Plus',
			message: tx(`La versión ${info.version} está lista`, `Version ${info.version} is ready`),
			detail: tx('Se instala al reiniciar la app.', 'It installs when the app restarts.'),
			buttons: [ tx('Reiniciar ahora', 'Restart now'), tx('Al cerrar la app', 'When I quit') ],
			defaultId: 0,
			cancelId: 1,
		});

		if (res == 0) {
			(app as any).isQuiting = true;
			autoUpdater.quitAndInstall(false, true);
		};
	};

	async onError (err: Error) {
		this.isChecking = false;
		this.isDownloading = false;

		const manual = this.manual;
		const msg = String(err?.message || err);

		this.setProgress(-1);
		Util.log('error', `[PlusUpdate] ${msg}`);

		// Un 401, 403 o 404 puede ser el token, pero también un Release a medio publicar, un límite de GitHub o
		// una caída. Antes de desconectar a nadie se le pregunta a GitHub por el token: solo se borra si lo rechaza.
		if (/\b(401|403|404)\b|Bad credentials|Not Found|ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|Cannot find .*\.yml/i.test(msg)) {
			const access = await this.checkAccess();

			if (access == 'revoked') {
				await this.disconnect(false);

				if (manual) {
					dialog.showMessageBoxSync(this.win, {
						type: 'warning',
						title: 'Anytype Plus',
						message: tx('Hay que volver a conectar GitHub', 'GitHub needs to be connected again'),
						detail: tx('El permiso venció o fue revocado. Usa «Conectar GitHub para actualizaciones…» en el menú.', 'The permission expired or was revoked. Use “Connect GitHub for updates…” in the menu.'),
					});
				};
				return;
			};

			if (access == 'noAccess') {
				if (manual) {
					dialog.showMessageBoxSync(this.win, {
						type: 'warning',
						title: 'Anytype Plus',
						message: tx('Tu cuenta de GitHub no tiene acceso al repo', 'Your GitHub account has no access to the repo'),
						detail: tx('Pide acceso a quien administra el repo y vuelve a buscar. No hace falta reconectar.', 'Ask the repo owner for access and check again. No need to reconnect.'),
					});
				};
				return;
			};

			if (access == 'ok') {
				if (manual) {
					dialog.showMessageBoxSync(this.win, {
						type: 'info',
						title: 'Anytype Plus',
						message: tx('Se está publicando una versión nueva', 'A new version is being published'),
						detail: tx('Todavía no está completa. Vuelve a buscar en unos minutos.', 'It is not complete yet. Check again in a few minutes.'),
					});
				};
				return;
			};
		};

		if (manual) {
			dialog.showMessageBoxSync(this.win, { type: 'warning', title: 'Anytype Plus', message: tx('No se pudo buscar actualizaciones', 'Could not check for updates'), detail: msg.slice(0, 500) });
		};
	};

	/** Conecta la cuenta de GitHub con el flujo «device» de una GitHub App. */
	async connect () {
		// Ya hay una conexión esperando la autorización (hasta 15 minutos): se vuelve a mostrar su código
		// en vez de no hacer nada.
		if (this.isConnecting) {
			const p = this.pending;

			if (p) {
				try { clipboard.writeText(p.code); } catch (e) { /**/ };

				const again = dialog.showMessageBoxSync(this.win, {
					type: 'info',
					title: 'Anytype Plus',
					message: tx(`Tu código de GitHub: ${p.code}`, `Your GitHub code: ${p.code}`),
					detail: tx(
						`Ya está copiado. La app está esperando que lo pegues en ${p.uri} y autorices «Anytype Plus updates».`,
						`It is already copied. The app is waiting for you to paste it at ${p.uri} and authorize “Anytype Plus updates”.`,
					),
					buttons: [ tx('Abrir GitHub', 'Open GitHub'), tx('Cerrar', 'Close') ],
					defaultId: 0,
					cancelId: 1,
				});

				if (again == 0) {
					shell.openExternal(p.uri);
				};
			};
			return;
		};

		const { clientId } = getConfig();
		this.isConnecting = true;

		try {
			const r = await fetch('https://github.com/login/device/code', {
				method: 'POST',
				headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ client_id: clientId }),
			});
			const code: any = await r.json();

			if (!code.device_code) {
				throw new Error(code.error_description || code.error || 'device code');
			};

			// El diálogo se cierra al abrir GitHub, justo cuando hace falta el código: queda copiado para pegarlo
			try { clipboard.writeText(String(code.user_code)); } catch (e) { /**/ };

			const res = dialog.showMessageBoxSync(this.win, {
				type: 'info',
				title: 'Anytype Plus',
				message: tx(`Tu código de GitHub: ${code.user_code}`, `Your GitHub code: ${code.user_code}`),
				detail: tx(
					`Ya está copiado.\n\n1. Se abrirá ${code.verification_uri}\n2. Pega el código (Cmd+V o Ctrl+V).\n3. Autoriza «Anytype Plus updates».\n\nSolo funciona con una cuenta que tenga acceso al repo.`,
					`It is already copied.\n\n1. ${code.verification_uri} will open\n2. Paste the code (Cmd+V or Ctrl+V).\n3. Authorize “Anytype Plus updates”.\n\nOnly works with an account that has access to the repo.`,
				),
				buttons: [ tx('Abrir GitHub', 'Open GitHub'), tx('Cancelar', 'Cancel') ],
				defaultId: 0,
				cancelId: 1,
			});

			if (res != 0) {
				return;
			};

			this.pending = { code: String(code.user_code), uri: String(code.verification_uri) };
			shell.openExternal(code.verification_uri);

			const token = await this.pollToken(clientId, code.device_code, Number(code.interval) || 5, Number(code.expires_in) || 900);

			if (!token) {
				throw new Error(tx('Se acabó el tiempo para escribir el código', 'The code expired'));
			};

			this.token = token;
			await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token);
			this.onChange?.();

			this.isConnecting = false;
			this.check(true);
		} catch (e) {
			dialog.showMessageBoxSync(this.win, { type: 'warning', title: 'Anytype Plus', message: tx('No se pudo conectar con GitHub', 'Could not connect GitHub'), detail: String((e as Error)?.message || e) });
		} finally {
			this.isConnecting = false;
			this.pending = null;
		};
	};

	async pollToken (clientId: string, deviceCode: string, interval: number, expiresIn: number): Promise<string> {
		const until = Date.now() + expiresIn * 1000;
		let wait = interval;

		while (Date.now() < until) {
			await new Promise(r => setTimeout(r, wait * 1000));

			const r = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ client_id: clientId, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
			});
			const data: any = await r.json();

			if (data.access_token) {
				return data.access_token;
			};

			if (data.error == 'slow_down') {
				wait += 5;
			} else
			if (data.error != 'authorization_pending') {
				throw new Error(data.error_description || data.error);
			};
		};

		return '';
	};

	async disconnect (ask: boolean) {
		if (ask) {
			const res = dialog.showMessageBoxSync(this.win, {
				type: 'question',
				title: 'Anytype Plus',
				message: tx('¿Desconectar GitHub?', 'Disconnect GitHub?'),
				detail: tx('La app dejará de buscar actualizaciones hasta que vuelvas a conectar.', 'The app will stop checking for updates until you connect again.'),
				buttons: [ tx('Desconectar', 'Disconnect'), tx('Cancelar', 'Cancel') ],
				defaultId: 1,
				cancelId: 1,
			});

			if (res != 0) {
				return;
			};
		};

		this.token = '';
		try { await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch (e) { /**/ };
		this.onChange?.();
	};

	/** Novedades de la versión instalada, la primera vez que se abre después de actualizar. */
	async showWhatsNew () {
		const version = app.getVersion();
		const last = String(ConfigManager.config.plusLastVersion || '');

		if (last == version) {
			return;
		};

		ConfigManager.set({ plusLastVersion: version });

		// Primera instalación: no hay «novedades» que mostrar
		if (!last || !this.token) {
			return;
		};

		const c = getConfig();
		let notes = '';

		try {
			const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/releases/tags/plus-v${version}`, {
				headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${this.token}` },
			});
			const data: any = await r.json();
			notes = plainNotes(data.body);
		} catch (e) { /**/ };

		setTimeout(() => {
			dialog.showMessageBox(this.win, {
				type: 'info',
				title: 'Anytype Plus',
				message: tx(`Anytype Plus se actualizó a la versión ${version}`, `Anytype Plus was updated to ${version}`),
				detail: notes || tx('Revisa las novedades en los Releases del repo.', 'See what changed in the repo releases.'),
			});
		}, 3000);
	};

};

export default new PlusUpdate();
