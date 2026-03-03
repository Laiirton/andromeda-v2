'use strict';

module.exports = {
    // ─── Bot ─────────────────────────────────────────────────────────────────
    bot: {
        name: 'Coiso',
        version: '2.0.0',
        prefix: '!',
        locale: 'pt-BR',
    },

    // ─── Figurinhas (Stickers) ────────────────────────────────────────────────
    sticker: {
        author: 'Coiso',
        pack: 'Coiso',
        maxDurationSeconds: 6,
        maxFileSizeMB: 10,
        quality: 80,
        size: 512,
        fps: 15,
    },

    // ─── Cooldowns (segundos) ─────────────────────────────────────────────────
    cooldown: {
        default: 3,
    },

    // ─── Admins (número@c.us ou número@g.us) ─────────────────────────────────
    // Adicione seu número aqui para ter acesso a comandos admin
    admins: [
        // Exemplo: '5511999999999@c.us'
    ],

    // ─── Puppeteer ────────────────────────────────────────────────────────────
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    },

    // ─── Supabase ─────────────────────────────────────────────────────────────
    // Configure as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY
    supabase: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
    },
};

