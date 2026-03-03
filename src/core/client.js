'use strict';

const { Client, RemoteAuth } = require('whatsapp-web.js');
const config = require('../config');
const SupabaseStore = require('../store/SupabaseStore');

const store = new SupabaseStore({
    supabaseUrl: config.supabase.url,
    supabaseKey: config.supabase.key,
});

const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'andromeda', // Define nome do arquivo no bucket: RemoteAuth-andromeda.zip
        store,
        backupSyncIntervalMs: 300_000, // Salva backup a cada 5 minutos
    }),
    puppeteer: config.puppeteer,
});

module.exports = client;
