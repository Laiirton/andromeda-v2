'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('../config');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: config.puppeteer,
});

module.exports = client;
