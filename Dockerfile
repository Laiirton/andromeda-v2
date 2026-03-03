# ── Estágio de build ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# Sistema: dependências do Chromium/Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc-s1 \
    libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils \
    ffmpeg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências (inclui download do Chromium pelo puppeteer + postinstall patches)
COPY package*.json ./
RUN npm install

# Copia o restante do projeto
COPY . .

# Porta do health check server
EXPOSE 3000

CMD ["npm", "start"]
