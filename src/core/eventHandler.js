'use strict';

const qrcode = require('qrcode-terminal');
const logger = require('./logger');
const { handleMessage, loadCommands } = require('./commandHandler');

/**
 * Registra todos os eventos do cliente WhatsApp.
 * @param {import('whatsapp-web.js').Client} client
 */
function registerEvents(client) {
    // ── QR Code para autenticação ─────────────────────────────────────────────
    client.on('qr', (qr) => {
        logger.info('Escaneie o QR Code abaixo com seu WhatsApp:');
        console.log('');
        qrcode.generate(qr, { small: true });
    });

    // ── Autenticação ──────────────────────────────────────────────────────────
    client.on('authenticated', () => {
        logger.success('Autenticado com sucesso!');
    });

    client.on('auth_failure', (msg) => {
        logger.error(`Falha na autenticação: ${msg}`);
        process.exit(1);
    });

    // ── Sessão salva no Supabase ──────────────────────────────────────────────
    client.on('remote_session_saved', () => {
        logger.success('✔ Sessão persistida no Supabase — próximo boot não precisará de QR Code!');
    });

    // ── Estado da conexão ─────────────────────────────────────────────────────
    client.on('change_state', (state) => {
        logger.info(`Estado da conexão: ${state}`);
    });

    // ── Pronto ────────────────────────────────────────────────────────────────
    client.on('ready', () => {
        loadCommands();
        logger.success('Bot pronto e aguardando mensagens.');
        logger.info('Envie !ajuda no WhatsApp para ver os comandos disponíveis.');
    });

    // ── Mensagens ─────────────────────────────────────────────────────────────
    client.on('message', (message) => {
        handleMessage(message, client).catch((err) => {
            logger.error('Erro não esperado no handler de mensagem', err);
        });
    });

    // ── Desconexão ────────────────────────────────────────────────────────────
    client.on('disconnected', (reason) => {
        logger.warn(`Bot desconectado: ${reason}`);
    });
}

module.exports = { registerEvents };

