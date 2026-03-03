'use strict';

const config = require('../config');

/**
 * Verifica se um userId está na lista de admins.
 * @param {string} userId  — ex: '5511999999999@c.us'
 * @returns {boolean}
 */
function isAdmin(userId) {
    return config.admins.includes(userId);
}

module.exports = { isAdmin };
