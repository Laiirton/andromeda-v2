'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../core/logger');

const BUCKET = 'whatsapp-sessions';

/**
 * Store customizado para whatsapp-web.js RemoteAuth usando Supabase Storage.
 *
 * Crie um bucket chamado "whatsapp-sessions" (private) no seu projeto Supabase.
 * Defina as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY.
 *
 * NOTA: o RemoteAuth passa `session` como caminho completo em store.save()
 * (ex: /path/.wwebjs_auth/RemoteAuth-andromeda), mas como nome simples em
 * store.sessionExists() e store.extract(). Tratamos ambos os casos via _sessionName().
 */
class SupabaseStore {
    constructor({ supabaseUrl, supabaseKey } = {}) {
        const url = supabaseUrl || process.env.SUPABASE_URL;
        const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY;

        if (!url || !key) {
            throw new Error(
                '[SupabaseStore] SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias.'
            );
        }

        this.supabase = createClient(url, key);
        logger.success('Supabase Storage conectado com sucesso.');
    }

    /**
     * Extrai apenas o nome base da sessão (sem diretório, sem extensão).
     * RemoteAuth pode passar caminho completo ou só o nome.
     */
    _sessionName(session) {
        return path.basename(session);
    }

    /** Nome do arquivo no bucket: ex RemoteAuth-andromeda.zip */
    _fileName(session) {
        return `${this._sessionName(session)}.zip`;
    }

    /**
     * Caminho local do .zip — o RemoteAuth cria o zip em dataPath/sessionName.zip
     * e passa o caminho completo (sem extensão) no parâmetro session.
     */
    _zipPath(session) {
        const isAbsolute = path.isAbsolute(session);
        return isAbsolute ? `${session}.zip` : `./${session}.zip`;
    }

    /** Verifica se a sessão já existe no bucket. */
    async sessionExists({ session }) {
        const fileName = this._fileName(session);
        logger.debug(`[Supabase] Verificando sessão: "${fileName}" ...`);

        const { data, error } = await this.supabase.storage
            .from(BUCKET)
            .list('', { search: fileName });

        if (error) throw new Error(`[SupabaseStore] sessionExists error: ${error.message}`);

        const exists = data.some((file) => file.name === fileName);

        if (exists) {
            logger.info('[Supabase] Sessão encontrada no Supabase.');
        } else {
            logger.warn('[Supabase] Nenhuma sessão no Supabase — QR Code será gerado.');
        }

        return exists;
    }

    /** Faz upload do .zip gerado pelo RemoteAuth para o Supabase Storage. */
    async save({ session }) {
        const fileName = this._fileName(session);
        const zipPath = this._zipPath(session);

        logger.info(`[Supabase] Salvando sessão: "${fileName}" (lendo de: ${zipPath}) ...`);

        if (!fs.existsSync(zipPath)) {
            throw new Error(`[SupabaseStore] Arquivo zip não encontrado: ${zipPath}`);
        }

        const fileBuffer = fs.readFileSync(zipPath);

        const { error } = await this.supabase.storage
            .from(BUCKET)
            .upload(fileName, fileBuffer, {
                contentType: 'application/zip',
                upsert: true,
            });

        if (error) throw new Error(`[SupabaseStore] save error: ${error.message}`);

        logger.success('[Supabase] Sessão salva! Próximos reinícios não precisarão de QR Code. 🎉');
    }

    /** Baixa o .zip do bucket e salva localmente para o RemoteAuth extrair. */
    async extract({ session, path: destPath }) {
        const fileName = this._fileName(session);
        logger.info(`[Supabase] Restaurando sessão: "${fileName}" → ${destPath} ...`);

        const { data, error } = await this.supabase.storage
            .from(BUCKET)
            .download(fileName);

        if (error) throw new Error(`[SupabaseStore] extract error: ${error.message}`);

        const arrayBuffer = await data.arrayBuffer();
        fs.mkdirSync(path.dirname(destPath), { recursive: true }); // garante que o diretório existe
        fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

        logger.success('[Supabase] Sessão restaurada com sucesso!');
    }

    /** Remove a sessão do bucket. */
    async delete({ session }) {
        const fileName = this._fileName(session);
        logger.info(`[Supabase] Removendo sessão: "${fileName}" ...`);

        const { error } = await this.supabase.storage
            .from(BUCKET)
            .remove([fileName]);

        if (error) throw new Error(`[SupabaseStore] delete error: ${error.message}`);

        logger.warn('[Supabase] Sessão removida do Supabase.');
    }
}

module.exports = SupabaseStore;
