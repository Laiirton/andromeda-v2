'use strict';

const { MessageMedia } = require('whatsapp-web.js');
const { imageToWebP, videoToAnimatedWebP } = require('../../utils/media');
const logger = require('../../core/logger');
const config = require('../../config');

module.exports = {
    name: 'fig',
    aliases: ['sticker', 'figurinha'],
    description: 'Converte imagem ou vídeo em figurinha',
    usage: '!fig  (envie junto com uma imagem ou vídeo)',
    cooldown: 10,
    adminOnly: false,

    async execute(message, args, client) {
        // ── Resolver a fonte da mídia: direta ou citada (reply) ───────────────
        let mediaSource = message;

        if (!message.hasMedia) {
            if (message.hasQuotedMsg) {
                const quoted = await message.getQuotedMessage();
                if (quoted.hasMedia) {
                    mediaSource = quoted;
                } else {
                    await message.reply(
                        '📎 A mensagem citada não contém mídia.\n' +
                        'Envie uma *imagem* ou *vídeo* com a legenda *!fig*, ou responda uma mídia com *!fig*.'
                    );
                    return;
                }
            } else {
                await message.reply(
                    '📎 Envie uma *imagem* ou *vídeo* com a legenda *!fig*, ' +
                    'ou responda uma mídia com *!fig*.'
                );
                return;
            }
        }

        // ── Verificar tamanho antes de baixar ─────────────────────────────────
        const maxBytes = config.sticker.maxFileSizeMB * 1024 * 1024;
        if (mediaSource._data?.size && mediaSource._data.size > maxBytes) {
            await message.reply(
                `❌ Arquivo muito grande. Máximo: *${config.sticker.maxFileSizeMB}MB*.`
            );
            return;
        }

        const media = await mediaSource.downloadMedia();
        if (!media || !media.data) {
            await message.reply('❌ Não foi possível baixar a mídia. Tente novamente.');
            return;
        }


        const mimeType = media.mimetype || '';
        const buffer = Buffer.from(media.data, 'base64');
        let stickerBuffer;
        let isAnimated = false;

        if (mimeType.startsWith('image/')) {
            logger.info('Convertendo imagem em figurinha estática...');
            stickerBuffer = await imageToWebP(buffer);

        } else if (mimeType.startsWith('video/') || mimeType.includes('gif')) {
            // Avisar o usuário que pode demorar (vídeos pesados = múltiplas tentativas)
            await message.reply('⏳ Processando figurinha animada, aguarde...');

            logger.info('Convertendo vídeo/GIF em figurinha animada (com recompressão automática)...');
            try {
                stickerBuffer = await videoToAnimatedWebP(buffer, mimeType);
            } catch (convErr) {
                logger.error('Todas as tentativas de conversão falharam', convErr);
                await message.reply(
                    '❌ Não foi possível criar a figurinha animada.\n\n' +
                    '💡 *Dicas:*\n' +
                    '• Envie um vídeo mais curto (máx. 6s)\n' +
                    '• Prefira vídeos menores que 5MB\n' +
                    '• Tente no formato MP4 ou GIF'
                );
                return;
            }
            isAnimated = true;

        } else {
            await message.reply(
                '❌ Formato não suportado.\n\n' +
                '✅ *Aceitos:* JPG, PNG, WebP, GIF, MP4, WebM'
            );
            return;
        }

        // ── Enviar figurinha ──────────────────────────────────────────────────
        const stickerMedia = new MessageMedia('image/webp', stickerBuffer.toString('base64'));

        // Nome de quem criou a figurinha
        const contact = await message.getContact();
        const authorName = contact.pushname || contact.name || message.from.split('@')[0];
        const createdAt = new Date().toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        try {
            await message.reply(stickerMedia, null, {
                sendMediaAsSticker: true,
                stickerName: `Criado por ${authorName}\r\n${createdAt}`,
                stickerAuthor: config.bot.name,
            });
            logger.success(`Figurinha ${isAnimated ? 'animada ' : ''}enviada para ${authorName}`);

        } catch (sendErr) {
            logger.error('Erro ao enviar figurinha via WhatsApp', sendErr);
            await message.reply(
                '❌ A figurinha foi criada mas não pôde ser enviada.\n\n' +
                '💡 Tente com um vídeo mais curto ou menor.'
            );
        }
    },
};
