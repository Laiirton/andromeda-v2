'use strict';

const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');

// Configurar caminho do ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Converte um buffer de imagem em WebP otimizado para figurinha.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function imageToWebP(buffer) {
    const { size, quality } = config.sticker;
    return sharp(buffer)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality })
        .toBuffer();
}

/**
 * Converte um buffer de vídeo/GIF em WebP animado para figurinha.
 * Tenta automaticamente recomprimir se o resultado ultrapassar o limite.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<Buffer>}
 */
async function videoToAnimatedWebP(buffer, mimeType) {
    // WhatsApp rejeita stickers animados > ~900KB via puppeteer
    const MAX_SIZE_BYTES = 900 * 1024;

    // Tentativas em escada: cada falha de tamanho usa configurações mais agressivas
    const attempts = [
        // Tentativa 1 — configurações padrão
        {
            fps: config.sticker.fps,
            duration: config.sticker.maxDurationSeconds,
            quality: 'default',
            size: config.sticker.size,
        },
        // Tentativa 2 — fps mais baixo, 4s
        {
            fps: 10,
            duration: 4,
            quality: 'default',
            size: config.sticker.size,
        },
        // Tentativa 3 — fps mínimo, 3s, resolução ligeiramente menor
        {
            fps: 8,
            duration: 3,
            quality: 'photo',
            size: 384,
        },
    ];

    const ext = mimeType.includes('mp4') ? '.mp4'
        : mimeType.includes('gif') ? '.gif'
            : mimeType.includes('webm') ? '.webm'
                : '.mp4';

    const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `andromeda_in_${uid}${ext}`);

    fs.writeFileSync(inputPath, buffer);

    let lastError;
    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        const outputPath = path.join(tmpDir, `andromeda_out_${uid}_t${i}.webp`);

        try {
            const webpBuffer = await _runFfmpeg(inputPath, outputPath, attempt);

            if (webpBuffer.length <= MAX_SIZE_BYTES) {
                cleanup(inputPath);
                return webpBuffer;
            }

            // Resultado muito grande — tentar próxima configuração
            cleanup(outputPath);
            lastError = new Error(
                `WebP gerado (${(webpBuffer.length / 1024).toFixed(0)}KB) ` +
                `excede o limite (${MAX_SIZE_BYTES / 1024}KB) — tentativa ${i + 1}`
            );
        } catch (err) {
            cleanup(outputPath);
            lastError = err;
        }
    }

    cleanup(inputPath);
    throw lastError ?? new Error('Não foi possível converter o vídeo em figurinha.');
}

/**
 * Executa o ffmpeg com as opções fornecidas e retorna o buffer WebP.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ fps: number, duration: number, quality: string, size: number }} opts
 * @returns {Promise<Buffer>}
 */
function _runFfmpeg(inputPath, outputPath, opts) {
    return new Promise((resolve, reject) => {
        const { fps, duration, quality, size } = opts;

        const durStr = String(duration).padStart(2, '0');
        // "Cover": escala até preencher o quadrado inteiro e recorta o centro —
        // garante fullscreen sem nenhuma borda preta ou branca.
        const scaleFilter =
            `scale=${size}:${size}:force_original_aspect_ratio=increase,` +
            `crop=${size}:${size},fps=${fps}`;


        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-filter:v', scaleFilter,
                '-loop', '0',
                '-ss', '0',
                '-t', `00:00:${durStr}`,
                '-preset', quality,
                '-an',
                '-vsync', '0',
                '-s', `${size}:${size}`,
            ])
            .save(outputPath)
            .on('end', () => {
                const webpBuffer = fs.readFileSync(outputPath);
                resolve(webpBuffer);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

/**
 * Remove arquivos temporários silenciosamente.
 * @param {...string} paths
 */
function cleanup(...paths) {
    for (const p of paths) {
        try { fs.unlinkSync(p); } catch (_) { /* silencioso */ }
    }
}

module.exports = { imageToWebP, videoToAnimatedWebP };
