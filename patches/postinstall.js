#!/usr/bin/env node
/**
 * patches/postinstall.js
 *
 * Aplica patches necessários em node_modules após cada `npm install`.
 * Executado automaticamente via "postinstall" em package.json.
 *
 * Patches aplicados em whatsapp-web.js/RemoteAuth.js:
 *   1. storeRemoteSession → try/catch para erros visíveis
 *   2. compressSession    → zipa apenas IndexedDB/LocalStorage/SessionStorage
 *                          (evita EBUSY em arquivos de Cache bloqueados pelo Chrome)
 *   3. deleteMetadata     → .catch(() => []) para não crashar com ENOENT
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'authStrategies', 'RemoteAuth.js');

if (!fs.existsSync(TARGET)) {
    console.log('[postinstall] RemoteAuth.js não encontrado, pulando patch.');
    process.exit(0);
}

let content = fs.readFileSync(TARGET, 'utf8');
let patched = 0;

/**
 * Aplica um patch usando strings marcadoras para detectar estado.
 * @param {string} marker   - Trecho único presente APENAS no código já patchado
 * @param {string} original - Trecho único presente APENAS no código original
 * @param {string} replacement - Novo código que substitui `original`
 * @param {string} name     - Nome descritivo do patch
 */
function applyPatch(marker, original, replacement, name) {
    if (content.includes(marker)) {
        console.log(`[postinstall] Patch "${name}" já aplicado, pulando.`);
        return 0;
    }
    if (!content.includes(original)) {
        console.warn(`[postinstall] AVISO: Patch "${name}" — alvo não encontrado. O pacote pode ter mudado de versão.`);
        return 0;
    }
    content = content.replace(original, replacement);
    console.log(`[postinstall] Patch "${name}" aplicado com sucesso.`);
    return 1;
}

// ─── Patch 1: storeRemoteSession — try/catch ─────────────────────────────────
patched += applyPatch(
    // Marcador: linha que só existe no código patchado
    `} catch (err) {\n                console.error('[RemoteAuth] Erro ao salvar sessao remota:'`,
    // Original (código sem try/catch)
    `        if (pathExists) {
            await this.compressSession();
            await this.store.save({ session: path.join(this.dataPath, this.sessionName) });
            await fs.promises.unlink(path.join(this.dataPath, \`\${this.sessionName}.zip\`));
            await fs.promises.rm(\`\${this.tempDir}\`, {
                recursive: true,
                force: true,
                maxRetries: this.rmMaxRetries,
            }).catch(() => { });
            if (options && options.emit) this.client.emit(Events.REMOTE_SESSION_SAVED);
        }`,
    // Replacement
    `        if (pathExists) {
            try {
                await this.compressSession();
                await this.store.save({ session: path.join(this.dataPath, this.sessionName) });
                await fs.promises.unlink(path.join(this.dataPath, \`\${this.sessionName}.zip\`));
                await fs.promises.rm(\`\${this.tempDir}\`, {
                    recursive: true,
                    force: true,
                    maxRetries: this.rmMaxRetries,
                }).catch(() => { });
                if (options && options.emit) this.client.emit(Events.REMOTE_SESSION_SAVED);
            } catch (err) {
                console.error('[RemoteAuth] Erro ao salvar sessao remota:', err.message || err);
            }
        }`,
    'storeRemoteSession try/catch'
);

// ─── Patch 2: compressSession — zipa só dirs essenciais ──────────────────────
patched += applyPatch(
    // Marcador: linha única do código patchado
    `const lockedFiles = new Set(['LOCK', 'LOG']);`,
    // Original (usa fs.copy com silentCatch e tempDir)
    `    async compressSession() {
        const archive = archiver('zip');
        const stream = fs.createWriteStream(path.join(this.dataPath, \`\${this.sessionName}.zip\`));

        await fs.copy(this.userDataDir, this.tempDir).catch(() => { });
        await this.deleteMetadata();
        return new Promise((resolve, reject) => {
            archive
                .directory(this.tempDir, false)
                .on('error', err => reject(err))
                .pipe(stream);

            stream.on('close', () => resolve());
            archive.finalize();
        });
    }`,
    // Replacement
    `    async compressSession() {
        const outputPath = path.join(this.dataPath, \`\${this.sessionName}.zip\`);
        const stream = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 1 } });

        const essentialDirs = ['IndexedDB', 'Local Storage', 'Session Storage'];
        const lockedFiles = new Set(['LOCK', 'LOG']);

        return new Promise((resolve, reject) => {
            archive.on('error', err => reject(err));
            archive.pipe(stream);

            for (const dir of essentialDirs) {
                const dirPath = path.join(this.userDataDir, 'Default', dir);
                if (fs.existsSync(dirPath)) {
                    archive.directory(dirPath, \`Default/\${dir}\`, (entry) => {
                        return lockedFiles.has(path.basename(entry.name)) ? false : entry;
                    });
                }
            }

            stream.on('close', () => resolve());
            archive.finalize();
        });
    }`,
    'compressSession essential dirs'
);

// ─── Patch 3: deleteMetadata — graceful ENOENT ───────────────────────────────
patched += applyPatch(
    // Marcador: linha única do código patchado
    `const sessionFiles = await fs.promises.readdir(dir).catch(() => []);`,
    // Original
    `            const sessionFiles = await fs.promises.readdir(dir);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = path.join(dir, element);
                    const stats = await fs.promises.lstat(dirElement);`,
    // Replacement
    `            const sessionFiles = await fs.promises.readdir(dir).catch(() => []);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = path.join(dir, element);
                    const stats = await fs.promises.lstat(dirElement).catch(() => null);
                    if (!stats) continue;`,
    'deleteMetadata graceful ENOENT'
);

// ─── Patch 4: setInterval — emite remote_session_saved em backups periódicos ──
patched += applyPatch(
    // Marcador: linha única do código patchado
    `await self.storeRemoteSession({ emit: true });`,
    // Original
    `            await self.storeRemoteSession();`,
    // Replacement
    `            await self.storeRemoteSession({ emit: true });`,
    'setInterval emit remote_session_saved'
);

// ─── Salva se houve mudança ───────────────────────────────────────────────────
if (patched > 0) {
    fs.writeFileSync(TARGET, content, 'utf8');
    console.log(`[postinstall] ${patched} patch(es) aplicado(s) em RemoteAuth.js ✅`);
} else {
    console.log('[postinstall] Nenhum patch novo necessário.');
}
