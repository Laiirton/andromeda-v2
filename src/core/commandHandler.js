'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');
const cooldown = require('../utils/cooldown');
const permissions = require('../utils/permissions');

/** @type {Map<string, object>} */
const commands = new Map();

// ─── Carregamento automático de comandos ──────────────────────────────────────

/**
 * Carrega recursivamente todos os arquivos .js dentro de `src/commands/`.
 */
function loadCommands() {
    const commandsDir = path.join(__dirname, '..', 'commands');
    const loaded = [];

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                try {
                    const command = require(fullPath);
                    if (!command.name) {
                        logger.warn(`Comando em ${entry.name} não tem a propriedade "name" — ignorado.`);
                        continue;
                    }
                    // Registrar pelo nome principal
                    commands.set(command.name.toLowerCase(), command);
                    // Registrar aliases
                    if (Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            commands.set(alias.toLowerCase(), command);
                        }
                    }
                    loaded.push(command.name);
                } catch (err) {
                    logger.error(`Erro ao carregar comando ${entry.name}`, err);
                }
            }
        }
    }

    walk(commandsDir);
    logger.success(`${loaded.length} comando(s) carregado(s): ${loaded.join(', ')}`);
}

// ─── Handler de mensagens ─────────────────────────────────────────────────────

/**
 * Processa uma mensagem recebida e executa o comando correspondente.
 * @param {import('whatsapp-web.js').Message} message
 * @param {import('whatsapp-web.js').Client} client
 */
async function handleMessage(message, client) {
    const body = (message.body || '').trim();

    if (!body.startsWith(config.bot.prefix)) return;

    const args = body.slice(config.bot.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) return;

    // Em grupos message.from é o ID do grupo; message.author é quem enviou de fato.
    // Em conversas privadas message.author é undefined — fallback para message.from.
    const sender = message.author || message.from;

    // Resolver nome de exibição do remetente para os logs
    let senderLabel;
    try {
        const contact = await message.getContact();
        senderLabel = contact.pushname || contact.name || contact.number || sender.split('@')[0];
    } catch (_) {
        senderLabel = sender.split('@')[0];
    }

    // ── Verificação de permissão admin ────────────────────────────────────────
    if (command.adminOnly && !permissions.isAdmin(sender)) {
        await message.reply('🔒 Você não tem permissão para usar este comando.');
        return;
    }

    // ── Verificação de cooldown ───────────────────────────────────────────────
    const seconds = command.cooldown ?? config.cooldown.default;
    const cd = cooldown.check(command.name, sender, seconds);
    if (cd.onCooldown) {
        await message.reply(
            `⏳ Aguarde *${cd.remaining}s* antes de usar *${config.bot.prefix}${command.name}* novamente.`
        );
        return;
    }

    // ── Execução ──────────────────────────────────────────────────────────────
    logger.command(`${config.bot.prefix}${command.name}`, senderLabel);
    try {
        await command.execute(message, args, client);
    } catch (err) {
        logger.error(`Erro ao executar comando "${command.name}"`, err);
        try {
            await message.reply('❌ Ocorreu um erro ao executar o comando. Tente novamente.');
        } catch (_) { /* silencioso */ }
    }
}

/**
 * Retorna todos os comandos carregados (sem duplicatas de aliases).
 * @returns {Map<string, object>}
 */
function getCommands() {
    // Retornar apenas entradas onde a chave é o nome principal (sem aliases)
    const unique = new Map();
    for (const [key, cmd] of commands) {
        if (key === cmd.name.toLowerCase()) unique.set(key, cmd);
    }
    return unique;
}

module.exports = { loadCommands, handleMessage, getCommands };
