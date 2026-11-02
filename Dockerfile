# Manter a versão do Node igual à do .nvmrc
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package*.json ./

# O mongodb-memory-server (só para os testes de integração) baixaria o
# binário do mongod no postinstall
ENV MONGOMS_DISABLE_POSTINSTALL=1

RUN npm ci

COPY tsconfig*.json ./
COPY src ./src

RUN npm run build


FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

COPY templates ./templates

EXPOSE 3001

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=10s \
  --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node

CMD ["node", "dist/server.js"]