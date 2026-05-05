#!/bin/bash
# scripts/deploy.sh
# Script de deploy/atualização em produção
# Uso: ./scripts/deploy.sh [--migrate] [--no-cache]

set -e  # para se qualquer comando falhar

COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="/opt/whatsapp-api"      # ajuste para o diretório do projeto

log() { echo "[$(date '+%H:%M:%S')] $1"; }
err() { echo "[ERRO] $1" >&2; exit 1; }

log "=== Iniciando deploy WhatsApp Business API ==="

# Verifica que .env existe
[ -f ".env" ] || err ".env não encontrado. Copie .env.example e preencha."

# Verifica variáveis críticas
check_var() {
  val=$(grep "^$1=" .env | cut -d= -f2)
  [ -z "$val" ] && err "Variável $1 não configurada no .env"
}

check_var "META_ACCESS_TOKEN"
check_var "META_PHONE_NUMBER_ID"
check_var "JWT_SECRET"
check_var "DB_PASSWORD"

log "Variáveis de ambiente: OK"

# Pull do código mais recente
if [ -d ".git" ]; then
  log "Atualizando código..."
  git pull origin main
fi

# Build da imagem
BUILD_FLAGS=""
[[ "$*" == *"--no-cache"* ]] && BUILD_FLAGS="--no-cache"
log "Build da imagem Docker..."
docker compose -f "$COMPOSE_FILE" build $BUILD_FLAGS api

# Para e sobe os containers
log "Atualizando containers..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps api

# Aguarda API ficar saudável
log "Aguardando API subir..."
for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    log "API está saudável!"
    break
  fi
  [ $i -eq 30 ] && err "API não ficou saudável após 30s"
  sleep 1
done

# Executa migrations se solicitado
if [[ "$*" == *"--migrate"* ]]; then
  log "Executando migrations..."
  docker compose -f "$COMPOSE_FILE" exec api node scripts/migrate.js
fi

# Limpeza de imagens antigas
log "Limpando imagens antigas..."
docker image prune -f

log "=== Deploy concluído com sucesso! ==="
docker compose -f "$COMPOSE_FILE" ps
