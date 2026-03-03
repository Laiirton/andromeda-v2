'use strict';

const config = require('../config');

// ─── Cores ANSI (sem dependências externas) ───────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timestamp() {
    return new Date().toLocaleString(config.bot.locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function pad(str, len = 7) {
    return str.padEnd(len);
}

function format(level, color, icon, message) {
    const ts = `${DIM}[${timestamp()}]${RESET}`;
    const tag = `${BOLD}${color}[${pad(level)}]${RESET}`;
    const ico = icon;
    return `${ts} ${tag} ${ico}  ${WHITE}${message}${RESET}`;
}

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = {
    info(message) {
        console.log(format('INFO', CYAN, '💬', message));
    },

    success(message) {
        console.log(format('OK', GREEN, '✅', message));
    },

    warn(message) {
        console.warn(format('AVISO', YELLOW, '⚠️', message));
    },

    error(message, err) {
        console.error(format('ERRO', RED, '❌', message));
        if (err) console.error(`${DIM}${err.stack || err}${RESET}`);
    },

    debug(message) {
        if (process.env.DEBUG === 'true') {
            console.log(format('DEBUG', MAGENTA, '🔍', message));
        }
    },

    command(name, sender) {
        console.log(format('CMD', BLUE, '⚡', `${BOLD}${name}${RESET}${WHITE} chamado por ${CYAN}${sender}${RESET}`));
    },

    banner() {
        console.log(`
${BOLD}${CYAN}╔══════════════════════════════════════════════════╗
║        🤖  Andromeda Bot  •  v${config.bot.version}            ║
║            WhatsApp Bot — Sistema Modular          ║
╚══════════════════════════════════════════════════╝${RESET}
`);
    },
};

module.exports = logger;
