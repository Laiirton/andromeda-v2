'use strict';

const { getCommands } = require('../../core/commandHandler');
const config = require('../../config');

module.exports = {
    name: 'ajuda',
    aliases: ['help', 'h', 'comandos'],
    description: 'Exibe a lista de comandos disponíveis',
    usage: '!ajuda [comando]',
    cooldown: 5,
    adminOnly: false,

    async execute(message, args, client) {
        const prefix = config.bot.prefix;

        // ── Ajuda de um comando específico ────────────────────────────────────
        if (args.length > 0) {
            const name = args[0].toLowerCase().replace(/^!/, '');
            const allCmds = getCommands();
            const cmd = allCmds.get(name);

            if (!cmd) {
                await message.reply(`❓ Comando *${prefix}${name}* não encontrado.`);
                return;
            }

            const lines = [
                `📖 *${prefix}${cmd.name}*`,
                ``,
                `📝 ${cmd.description}`,
                ``,
                `🔧 *Uso:* ${cmd.usage || `${prefix}${cmd.name}`}`,
            ];
            if (cmd.aliases?.length) {
                lines.push(`🔀 *Aliases:* ${cmd.aliases.map(a => `${prefix}${a}`).join(', ')}`);
            }
            if (cmd.cooldown) {
                lines.push(`⏳ *Cooldown:* ${cmd.cooldown}s`);
            }
            if (cmd.adminOnly) {
                lines.push(`🔒 *Restrito a admins*`);
            }

            await message.reply(lines.join('\n'));
            return;
        }

        // ── Lista geral dos comandos ───────────────────────────────────────────
        const allCmds = getCommands();
        const cmdLines = [...allCmds.values()]
            .map(cmd => `  • *${prefix}${cmd.name}* — ${cmd.description}`)
            .join('\n');

        const text = [
            `🤖 *${config.bot.name} v${config.bot.version}*`,
            ``,
            `📋 *Comandos disponíveis:*`,
            cmdLines,
            ``,
            `💡 Use *${prefix}ajuda [comando]* para detalhes de um comando específico.`,
        ].join('\n');

        await message.reply(text);
    },
};
