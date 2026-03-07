'use strict';

const https = require('https');
const http = require('http');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../../core/logger');

// URL da API pública TikWM — retorna vídeo sem marca d'água
const TIKWM_API = 'https://www.tikwm.com/api/';

// Tamanho máximo de vídeo aceito (50 MB)
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Faz uma requisição POST simples e retorna a resposta como string.
 * @param {string} url
 * @param {string} postData
 * @returns {Promise<string>}
 */
function httpPost(url, postData) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (compatible; AndromedaBot/2.0)',
            },
        };

        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.setTimeout(15_000, () => {
            req.destroy(new Error('Timeout ao consultar a API do TikTok.'));
        });
        req.write(postData);
        req.end();
    });
}

/**
 * Baixa o conteúdo de uma URL e retorna como Buffer.
 * Segue redirects (máx. 5) e rejeita se o tamanho ultrapassar MAX_VIDEO_BYTES.
 * @param {string} url
 * @param {number} [redirectsLeft=5]
 * @returns {Promise<Buffer>}
 */
function downloadBuffer(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AndromedaBot/2.0)',
                'Referer': 'https://www.tiktok.com/',
            },
        };

        const doRequest = (reqUrl, remaining) => {
            const reqParsed = new URL(reqUrl);
            const reqLib = reqParsed.protocol === 'https:' ? https : http;
            const reqOptions = {
                ...options,
                hostname: reqParsed.hostname,
                path: reqParsed.pathname + reqParsed.search,
            };

            const req = reqLib.request(reqOptions, (res) => {
                // Seguir redirect
                if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)
                    && res.headers.location) {
                    res.resume(); // Descartar o corpo do redirect
                    if (remaining <= 0) {
                        reject(new Error('Muitos redirecionamentos ao baixar o vídeo.'));
                        return;
                    }
                    doRequest(res.headers.location, remaining - 1);
                    return;
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} ao baixar o vídeo.`));
                    return;
                }

                const chunks = [];
                let totalBytes = 0;

                res.on('data', (chunk) => {
                    totalBytes += chunk.length;
                    if (totalBytes > MAX_VIDEO_BYTES) {
                        res.destroy();
                        reject(new Error('Vídeo muito grande (máx. 50 MB).'));
                        return;
                    }
                    chunks.push(chunk);
                });

                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(60_000, () => {
                req.destroy(new Error('Timeout ao baixar o vídeo.'));
            });
            req.end();
        };

        doRequest(url, redirectsLeft);
    });
}

/**
 * Valida se a string é um link do TikTok.
 * @param {string} url
 * @returns {boolean}
 */
function isTikTokUrl(url) {
    return /tiktok\.com/i.test(url) || /vm\.tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url);
}

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tiktokdl'],
    description: 'Baixa e envia um vídeo do TikTok (sem marca d\'água)',
    usage: '!tiktok <link do TikTok>',
    cooldown: 20,
    adminOnly: false,

    async execute(message, args) {
        const url = (args[0] || '').trim();

        if (!url) {
            await message.reply(
                '🎵 *TikTok Downloader*\n\n' +
                'Envie o link de um vídeo do TikTok:\n' +
                '`!tiktok https://www.tiktok.com/@usuario/video/...`\n\n' +
                '💡 Links curtos (vm.tiktok.com) também funcionam.'
            );
            return;
        }

        if (!isTikTokUrl(url)) {
            await message.reply('❌ Link inválido. Envie um link do TikTok (tiktok.com ou vm.tiktok.com).');
            return;
        }

        await message.reply('⏳ Baixando o vídeo, aguarde...');

        // ── Consultar TikWM API ───────────────────────────────────────────────
        let videoUrl;
        let videoTitle = '';
        try {
            const postData = `url=${encodeURIComponent(url)}&hd=1`;
            const rawResponse = await httpPost(TIKWM_API, postData);

            let json;
            try {
                json = JSON.parse(rawResponse);
            } catch {
                throw new Error('Resposta inválida da API.');
            }

            if (json.code !== 0 || !json.data) {
                throw new Error(json.msg || 'Não foi possível obter o vídeo.');
            }

            // Preferir versão HD; fallback para versão padrão
            videoUrl   = json.data.hdplay || json.data.play;
            videoTitle = json.data.title  || '';

            if (!videoUrl) {
                throw new Error('URL de download não encontrada na resposta.');
            }
        } catch (err) {
            logger.error('Erro ao consultar TikWM API', err);
            await message.reply(
                '❌ Não foi possível obter as informações do vídeo.\n\n' +
                '💡 Verifique se o link está correto e se o vídeo é público.'
            );
            return;
        }

        // ── Baixar buffer do vídeo ────────────────────────────────────────────
        let videoBuffer;
        try {
            logger.info(`Baixando vídeo TikTok: ${videoUrl}`);
            videoBuffer = await downloadBuffer(videoUrl);
        } catch (err) {
            logger.error('Erro ao baixar vídeo do TikTok', err);
            await message.reply(
                '❌ Falha ao baixar o vídeo.\n\n' +
                `💡 ${err.message}`
            );
            return;
        }

        // ── Enviar vídeo via WhatsApp ─────────────────────────────────────────
        const caption = videoTitle ? `🎵 ${videoTitle}` : '🎵 TikTok';
        const media   = new MessageMedia('video/mp4', videoBuffer.toString('base64'), 'tiktok.mp4');

        try {
            await message.reply(media, null, { caption, sendVideoAsGif: false });

            let senderName;
            try {
                const contact = await message.getContact();
                senderName = contact.pushname || contact.name || contact.number
                    || (message.author || message.from).split('@')[0];
            } catch (_) {
                senderName = (message.author || message.from).split('@')[0];
            }

            logger.success(
                `Vídeo TikTok enviado para ${senderName} ` +
                `(${(videoBuffer.length / 1024).toFixed(0)} KB)`
            );
        } catch (sendErr) {
            logger.error('Erro ao enviar vídeo TikTok via WhatsApp', sendErr);
            await message.reply(
                '❌ O vídeo foi baixado mas não pôde ser enviado.\n\n' +
                '💡 Certifique-se de que o bot está usando o *Google Chrome* ' +
                '(não o Chromium) para suporte a vídeos MP4.\n' +
                'Configure *CHROME_EXECUTABLE_PATH* no arquivo *.env*.'
            );
        }
    },
};
