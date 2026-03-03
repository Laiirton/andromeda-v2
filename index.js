'use strict';

require('dotenv').config(); // Carrega o .env antes de qualquer outro módulo

const logger = require('./src/core/logger');
const client = require('./src/core/client');
const { registerEvents } = require('./src/core/eventHandler');

// Exibir banner inicial
logger.banner();

// Registrar todos os eventos (QR, auth, ready, message, disconnect)
registerEvents(client);

// Iniciar conexão
logger.info('Iniciando cliente WhatsApp...');
client.initialize().catch((err) => {
    logger.error('Falha crítica ao inicializar o cliente', err);
    process.exit(1);
});

