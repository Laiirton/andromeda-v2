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
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<Buffer>}
 */
function videoToAnimatedWebP(buffer, mimeType) {
    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const ext = mimeType.includes('mp4') ? '.mp4'
            : mimeType.includes('gif') ? '.gif'
                : mimeType.includes('webm') ? '.webm'
                    : '.mp4';

        const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const inputPath = path.join(tmpDir, `andromeda_in_${uid}${ext}`);
        const outputPath = path.join(tmpDir, `andromeda_out_${uid}.webp`);

        fs.writeFileSync(inputPath, buffer);

        const { size, fps, maxDurationSeconds } = config.sticker;
        const scaleFilter =
            `scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
            `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=white@0.0,fps=${fps}`;

        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-filter:v', scaleFilter,
                '-loop', '0',
                '-ss', '0',
                '-t', `00:00:0${maxDurationSeconds}`,
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-s', `${size}:${size}`,
            ])
            .save(outputPath)
            .on('end', () => {
                const webpBuffer = fs.readFileSync(outputPath);
                cleanup(inputPath, outputPath);
                resolve(webpBuffer);
            })
            .on('error', (err) => {
                cleanup(inputPath, outputPath);
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
