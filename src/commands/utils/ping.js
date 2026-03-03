'use strict';

const config = require('../../config');

// Registrar o momento em que o bot iniciou
const startedAt = Date.now();

module.exports = {
    name: 'ping',
    aliases: ['status', 'uptime'],
    description: 'Verifica a latência e o tempo online do bot',
    usage: '!ping',
    cooldown: 5,
    adminOnly: false,

    async execute(message, args, client) {
        const send = Date.now();
        const sent = await message.reply('🏓 Calculando...');
        const roundtrip = Date.now() - send;

        const uptimeMs = Date.now() - startedAt;
        const uptime = formatUptime(uptimeMs);

        const text = [
            `🏓 *Pong!*`,
            ``,
            `⚡ *Latência:* ${roundtrip}ms`,
            `⏱️  *Online há:* ${uptime}`,
            `🤖 *Bot:* ${config.bot.name} v${config.bot.version}`,
        ].join('\n');

        await sent.edit(text);
    },
};

/**
 * Formata ms em "Xd Xh Xm Xs".
 * @param {number} ms
 * @returns {string}
 */
function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${sec}s`);
    return parts.join(' ');
}
