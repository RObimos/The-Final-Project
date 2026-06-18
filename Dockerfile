# Image légère officielle Node.js 20 (Alpine)
FROM node:20-alpine

# Outil pour le health check du conteneur
RUN apk add --no-cache wget

WORKDIR /app

# Installation des dépendances (couche mise en cache tant que package.json ne change pas)
COPY package*.json ./
RUN npm install --omit=dev

# Code de l'application
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check au niveau du conteneur (complémentaire à celui de Coolify)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
