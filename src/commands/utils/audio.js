'use strict';

const { MessageMedia } = require('whatsapp-web.js');
const { videoToAudio } = require('../../utils/media');
const logger = require('../../core/logger');
const config = require('../../config');

// MIME types de vídeo e áudio aceitos como entrada
const ACCEPTED_MIME_PREFIXES = ['video/', 'audio/'];
const FORMATS_LABEL = 'MP4, WebM, 3GP, MKV, MP3, M4A, OGG';

module.exports = {
    name: 'audio',
    aliases: ['som', 'mp3', 'extrairaudio'],
    description: 'Extrai o áudio de um vídeo e envia como arquivo ou nota de voz',
    usage: '!audio [voz]  (envie ou responda um vídeo — "voz" envia como nota de voz PTT)',
    cooldown: 15,
    adminOnly: false,

    async execute(message, args, client) {
        // ── Modo: arquivo MP3 (padrão) ou nota de voz OGG PTT ────────────────
        const voiceMode = ['voz', 'ptt', 'voice'].includes((args[0] || '').toLowerCase());
        const format    = voiceMode ? 'ogg' : 'mp3';

        // ── Resolver fonte da mídia: direta ou citada (reply) ─────────────────
        let mediaSource = message;

        if (!message.hasMedia) {
            if (message.hasQuotedMsg) {
                const quoted = await message.getQuotedMessage();
                if (quoted.hasMedia) {
                    mediaSource = quoted;
                } else {
                    await message.reply(
                        '📎 A mensagem citada não contém mídia.\n' +
                        'Envie um *vídeo* com a legenda *!audio*, ou responda um vídeo com *!audio*.'
                    );
                    return;
                }
            } else {
                await message.reply(
                    '📎 Envie um *vídeo* com a legenda *!audio*, ' +
                    'ou responda um vídeo com *!audio*.\n\n' +
                    `✅ *Aceitos:* ${FORMATS_LABEL}\n` +
                    '💡 Use *!audio voz* para receber como nota de voz (PTT).'
                );
                return;
            }
        }

        // ── Validar tipo de mídia ─────────────────────────────────────────────
        const rawMime = (mediaSource._data?.mimetype || '').split(';')[0].trim().toLowerCase();
        const isAccepted = ACCEPTED_MIME_PREFIXES.some(prefix => rawMime.startsWith(prefix));

        if (rawMime && !isAccepted) {
            await message.reply(
                '❌ Formato não suportado.\n\n' +
                `✅ *Aceitos:* ${FORMATS_LABEL}`
            );
            return;
        }

        // ── Verificar tamanho antes de baixar ─────────────────────────────────
        const maxBytes = config.audio.maxFileSizeMB * 1024 * 1024;
        if (mediaSource._data?.size && mediaSource._data.size > maxBytes) {
            await message.reply(
                `❌ Arquivo muito grande. Máximo: *${config.audio.maxFileSizeMB}MB*.`
            );
            return;
        }

        // ── Baixar mídia ──────────────────────────────────────────────────────
        const media = await mediaSource.downloadMedia();
        if (!media || !media.data) {
            await message.reply('❌ Não foi possível baixar a mídia. Tente novamente.');
            return;
        }

        const mimeType = media.mimetype || 'video/mp4';
        const buffer   = Buffer.from(media.data, 'base64');

        await message.reply(
            voiceMode
                ? '🎙️ Convertendo para nota de voz, aguarde...'
                : '🎵 Extraindo áudio, aguarde...'
        );

        // ── Extrair áudio ─────────────────────────────────────────────────────
        let audioBuffer;
        try {
            logger.info(`Extraindo áudio (formato: ${format}, mime: ${mimeType})...`);
            audioBuffer = await videoToAudio(buffer, mimeType, format);
        } catch (err) {
            if (err.message === 'NO_AUDIO_STREAM') {
                await message.reply(
                    '❌ Este vídeo não possui trilha de áudio.\n\n' +
                    '💡 Certifique-se de enviar um vídeo com som.'
                );
                return;
            }
            logger.error('Erro ao extrair áudio', err);
            await message.reply(
                '❌ Não foi possível extrair o áudio.\n\n' +
                '💡 *Dicas:*\n' +
                '• Verifique se o vídeo possui som\n' +
                '• Tente com um arquivo menor\n' +
                '• Formatos aceitos: ' + FORMATS_LABEL
            );
            return;
        }

        // ── Enviar áudio ──────────────────────────────────────────────────────
        const mimetype  = voiceMode ? 'audio/ogg; codecs=opus' : 'audio/mpeg';
        const filename  = voiceMode ? 'audio.ogg' : 'audio.mp3';
        const audioMedia = new MessageMedia(mimetype, audioBuffer.toString('base64'), filename);

        try {
            if (voiceMode) {
                await message.reply(audioMedia, null, { sendAudioAsVoice: true });
            } else {
                await message.reply(audioMedia);
            }
            let senderName;
            try {
                const contact = await message.getContact();
                senderName = contact.pushname || contact.name || contact.number || (message.author || message.from).split('@')[0];
            } catch (_) {
                senderName = (message.author || message.from).split('@')[0];
            }
            logger.success(
                `Áudio ${voiceMode ? '(PTT) ' : ''}enviado para ${senderName} ` +
                `(${(audioBuffer.length / 1024).toFixed(0)} KB)`
            );
        } catch (sendErr) {
            logger.error('Erro ao enviar áudio via WhatsApp', sendErr);
            await message.reply(
                '❌ O áudio foi extraído mas não pôde ser enviado.\n\n' +
                '💡 Tente com um vídeo mais curto ou menor.'
            );
        }
    },
};
