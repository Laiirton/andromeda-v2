const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Criar cliente WhatsApp com autenticação local (salva a sessão)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Gerar QR Code no terminal para autenticação
client.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code abaixo com seu WhatsApp:\n');
    qrcode.generate(qr, { small: true });
});

// Evento de autenticação bem-sucedida
client.on('authenticated', () => {
    console.log('✅ Autenticado com sucesso!');
});

// Evento de falha na autenticação
client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

// Evento de cliente pronto
client.on('ready', () => {
    console.log('🤖 Bot iniciado e pronto para uso!');
    console.log('💡 Envie uma imagem/vídeo com a legenda "!fig" para criar uma figurinha.');
});

// Função para converter imagem em WebP (figurinha estática)
async function imageToWebP(buffer) {
    return await sharp(buffer)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 80 })
        .toBuffer();
}

// Função para converter vídeo em WebP animado (figurinha animada)
async function videoToAnimatedWebP(buffer, mimeType) {
    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const inputExt = mimeType.includes('mp4') ? '.mp4' :
                         mimeType.includes('gif') ? '.gif' :
                         mimeType.includes('webm') ? '.webm' : '.mp4';
        
        const inputPath = path.join(tmpDir, `sticker_input_${Date.now()}${inputExt}`);
        const outputPath = path.join(tmpDir, `sticker_output_${Date.now()}.webp`);

        // Salvar buffer no arquivo temporário
        fs.writeFileSync(inputPath, buffer);

        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-filter:v', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,fps=15',
                '-loop', '0',
                '-ss', '0',
                '-t', '00:00:06',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-s', '512:512'
            ])
            .save(outputPath)
            .on('end', () => {
                const webpBuffer = fs.readFileSync(outputPath);
                // Limpar arquivos temporários
                try { fs.unlinkSync(inputPath); } catch (e) {}
                try { fs.unlinkSync(outputPath); } catch (e) {}
                resolve(webpBuffer);
            })
            .on('error', (err) => {
                // Limpar arquivos temporários em caso de erro
                try { fs.unlinkSync(inputPath); } catch (e) {}
                try { fs.unlinkSync(outputPath); } catch (e) {}
                reject(err);
            });
    });
}

// Escutar mensagens
client.on('message', async (message) => {
    try {
        const body = (message.body || '').trim().toLowerCase();
        const hasMedia = message.hasMedia;
        const type = message.type;

        // Verificar se é o comando !fig com mídia
        if (body === '!fig' && hasMedia) {
            console.log(`📨 Comando !fig recebido de ${message.from}`);

            // Baixar a mídia
            const media = await message.downloadMedia();

            if (!media || !media.data) {
                await message.reply('❌ Não foi possível baixar a mídia. Tente novamente.');
                return;
            }

            const mimeType = media.mimetype || '';
            const buffer = Buffer.from(media.data, 'base64');

            let stickerBuffer;
            let isAnimated = false;

            // Verificar tipo de mídia
            if (mimeType.startsWith('image/')) {
                // Imagem estática → figurinha estática
                console.log('🖼️  Convertendo imagem para figurinha...');
                stickerBuffer = await imageToWebP(buffer);
                isAnimated = false;
            } else if (mimeType.startsWith('video/') || mimeType.includes('gif')) {
                // Vídeo ou GIF → figurinha animada
                console.log('🎬 Convertendo vídeo/gif para figurinha animada...');
                stickerBuffer = await videoToAnimatedWebP(buffer, mimeType);
                isAnimated = true;
            } else {
                await message.reply('❌ Formato não suportado. Envie uma imagem (JPG, PNG, WebP) ou vídeo (MP4, GIF).');
                return;
            }

            // Criar objeto MessageMedia com o WebP
            const stickerMedia = new MessageMedia(
                'image/webp',
                stickerBuffer.toString('base64')
            );

            // Enviar como figurinha
            await message.reply(stickerMedia, null, {
                sendMediaAsSticker: true,
                stickerAuthor: 'Bot',
                stickerName: 'Figurinha'
            });

            console.log(`✅ Figurinha ${isAnimated ? 'animada ' : ''}enviada com sucesso!`);
        }

        // Mensagem de ajuda
        if (body === '!ajuda' || body === '!help') {
            await message.reply(
                '🤖 *WhatsApp Sticker Bot*\n\n' +
                '📌 *Como usar:*\n' +
                'Envie uma imagem ou vídeo com a legenda *!fig* para converter em figurinha.\n\n' +
                '📋 *Formatos suportados:*\n' +
                '• Imagens: JPG, PNG, WebP, HEIC\n' +
                '• Vídeos: MP4, GIF, WebM (máx. 6 segundos)\n\n' +
                '💡 *Dicas:*\n' +
                '• A figurinha terá 512x512 pixels\n' +
                '• Vídeos serão convertidos em figurinhas animadas'
            );
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        try {
            await message.reply('❌ Ocorreu um erro ao criar a figurinha. Tente novamente.');
        } catch (e) {}
    }
});

// Iniciar cliente
console.log('🚀 Iniciando WhatsApp Bot...');
client.initialize();
