'use strict';

const http = require('http');

const PORT = process.env.PORT || 3000;

/**
 * Servidor HTTP mínimo para manter o serviço do Render ativo.
 *
 * O plano free do Render hiberna Web Services após 15 min sem requests.
 * Use o UptimeRobot (https://uptimerobot.com, gratuito) para pingar
 * a URL do serviço a cada 14 minutos e manter o bot acordado 24/7.
 */
function startHealthServer() {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                bot: 'Andromeda v2.0.0',
                uptime: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
            }));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    server.listen(PORT, () => {
        console.log(`[health] Servidor de health check rodando na porta ${PORT}`);
    });

    return server;
}

module.exports = { startHealthServer };
