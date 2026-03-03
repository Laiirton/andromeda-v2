'use strict';

/** @type {Map<string, Map<string, number>>} commandName → userId → expiresAt */
const cooldowns = new Map();

/**
 * Verifica se um usuário está em cooldown para um dado comando.
 * @param {string} commandName
 * @param {string} userId
 * @param {number} seconds
 * @returns {{ onCooldown: boolean, remaining: number }} remaining em segundos
 */
function check(commandName, userId, seconds) {
    if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());

    const timestamps = cooldowns.get(commandName);
    const now = Date.now();
    const cooldownMs = seconds * 1000;

    if (timestamps.has(userId)) {
        const expiresAt = timestamps.get(userId);
        if (now < expiresAt) {
            const remaining = ((expiresAt - now) / 1000).toFixed(1);
            return { onCooldown: true, remaining: Number(remaining) };
        }
    }

    // Registrar uso e agendar limpeza automática
    timestamps.set(userId, now + cooldownMs);
    setTimeout(() => timestamps.delete(userId), cooldownMs);

    return { onCooldown: false, remaining: 0 };
}

module.exports = { check };
