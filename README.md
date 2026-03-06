# Andromeda V2 — WhatsApp Bot

Bot WhatsApp profissional e modular com sistema de comandos extensível.

---

## 🚀 Iniciando

```bash
# Produção
npm start

# Desenvolvimento (com reload automático)
npm run dev
```

Escaneie o QR Code que aparecer no terminal com o WhatsApp do seu celular.

---

## 📋 Comandos disponíveis

| Comando         | Aliases                        | Descrição                               |
|-----------------|--------------------------------|-----------------------------------------|
| `!fig`          | `!sticker`, `!figurinha`       | Converte imagem/vídeo em figurinha      |
| `!menu`         | `!help`, `!h`, `!comandos`, `!ajuda` | Lista todos os comandos           |
| `!ping`         | `!status`, `!uptime`           | Verifica latência e tempo online        |

---

## ➕ Como adicionar um novo comando

Crie um arquivo em `src/commands/<categoria>/nomeDoComando.js`:

```js
'use strict';

module.exports = {
    name: 'meucomando',          // Nome principal (sem prefixo)
    aliases: ['mc', 'meu'],      // Apelidos (opcional)
    description: 'Faz algo',
    usage: '!meucomando [args]',
    cooldown: 5,                 // Segundos de cooldown (opcional)
    adminOnly: false,            // Restrito a admins? (opcional)

    async execute(message, args, client) {
        await message.reply('Funcionou!');
    },
};
```

**Pronto.** O sistema carrega automaticamente ao iniciar — sem tocar em mais nenhum arquivo.

---

## ⚙️ Configuração

Edite `src/config/index.js` para ajustar:
- **Prefixo** dos comandos (padrão: `!`)
- **Admins** — adicione seu número no formato `5511999999999@c.us`
- **Figurinhas** — autor, nome do pack, qualidade, tamanho máximo
- **Cooldown** padrão global

---

## 🏗️ Estrutura do projeto

```
andromeda-v2/
├── index.js                     ← Ponto de entrada
├── src/
│   ├── config/index.js          ← Configurações centralizadas
│   ├── core/
│   │   ├── client.js            ← Instância do cliente WhatsApp
│   │   ├── logger.js            ← Logger colorido com timestamp
│   │   ├── commandHandler.js    ← Carregador automático de comandos
│   │   └── eventHandler.js      ← Eventos do cliente (qr, ready, etc.)
│   ├── commands/
│   │   └── utils/
│   │       ├── sticker.js       ← !fig
│   │       ├── help.js          ← !menu
│   │       └── ping.js          ← !ping
│   └── utils/
│       ├── media.js             ← Conversão imagem/vídeo → WebP
│       ├── cooldown.js          ← Rate limiting por usuário
│       └── permissions.js       ← Sistema de permissões
```

---

## 🔧 Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DEBUG=true` | Ativa logs de debug no terminal |
