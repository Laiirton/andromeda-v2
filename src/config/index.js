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

    // ─── Áudio ────────────────────────────────────────────────────────────────
    audio: {
        maxFileSizeMB: 50,
        voiceBitrate: '128k',  // OGG Opus (nota de voz / PTT) — transparente com Opus
        // MP3 usa VBR q:0 (~240–320 kbps) — sem configuração extra necessária
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
    // Para enviar vídeos (MP4/H.264) é necessário usar o Chrome instalado,
    // pois o Chromium embutido não suporta codecs licenciados (H.264/AAC).
    // Defina CHROME_EXECUTABLE_PATH no .env para apontar para o Chrome.
    puppeteer: {
        headless: true,
        ...(process.env.CHROME_EXECUTABLE_PATH
            ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
            : {}),
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

