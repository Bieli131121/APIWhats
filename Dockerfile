# Dockerfile
# Build multi-stage para imagem enxuta em produção

# ---- Estágio 1: dependências ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ---- Estágio 2: imagem final ----
FROM node:20-alpine AS runner
WORKDIR /app

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

# Copia dependências e código
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:nodejs . .

# Cria diretório de logs
RUN mkdir -p logs && chown appuser:nodejs logs

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "src/server.js"]
