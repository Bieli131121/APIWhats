#!/bin/bash
# scripts/test-api.sh
# Testes manuais completos da API via curl
# Uso: chmod +x scripts/test-api.sh && ./scripts/test-api.sh
#
# Pré-requisitos:
#   - API rodando em localhost:3000
#   - node scripts/migrate.js e node scripts/seed.js executados
#   - Variáveis de ambiente configuradas

BASE_URL="http://localhost:3000/api/v1"
ADMIN_EMAIL="admin@seudominio.com"
ADMIN_PASSWORD="TroqueEsta@Senha123"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
log_fail() { echo -e "${RED}✗ $1${NC}"; }
log_info() { echo -e "${YELLOW}  $1${NC}"; }

echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}   WhatsApp Business API — Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

# ---- 1. Health Check ----
log_step "1. Health Check"
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo "$HEALTH" | grep -q '"healthy"' && log_ok "API saudável" || log_fail "API degradada"

# ---- 2. Login ----
log_step "2. Autenticação"
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -n "$TOKEN" ]; then
  log_ok "Login bem-sucedido"
  log_info "Token: ${TOKEN:0:30}..."
else
  log_fail "Falha no login"
  echo "$LOGIN_RESP"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ---- 3. Cadastrar contato com opt-in ----
log_step "3. Cadastrar contato com opt-in documentado"
CONTACT_RESP=$(curl -s -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "phone": "+5511999990001",
    "name": "Maria Teste",
    "email": "maria@email.com",
    "opted_in": "true",
    "opted_in_source": "website_form",
    "opted_in_confirmation": "Aceito receber mensagens via WhatsApp sobre meus pedidos.",
    "tags": ["clientes", "teste"],
    "custom_data": { "cpf": "000.000.000-00", "plano": "premium" }
  }')
echo "$CONTACT_RESP" | python3 -m json.tool 2>/dev/null
echo "$CONTACT_RESP" | grep -q '"success"' && log_ok "Contato criado com opt-in" || log_fail "Erro ao criar contato"

# ---- 4. Tentar cadastrar SEM opt-in (deve falhar) ----
log_step "4. Validação: cadastro sem opt-in (deve retornar 400)"
NO_OPTIN_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"phone": "+5511999990002", "opted_in": "false", "opted_in_source": "test"}')
[ "$NO_OPTIN_RESP" = "400" ] && log_ok "Corretamente rejeitado (400)" || log_fail "Deveria ter retornado 400, recebeu $NO_OPTIN_RESP"

# ---- 5. Listar contatos ----
log_step "5. Listar contatos com opt-in"
CONTACTS=$(curl -s "$BASE_URL/contacts?opted_in=true&limit=5" \
  -H "$AUTH_HEADER")
TOTAL=$(echo "$CONTACTS" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
log_info "Total de contatos com opt-in: $TOTAL"

# ---- 6. Sincronizar templates (requer META_ACCESS_TOKEN válido) ----
log_step "6. Sincronizar templates da Meta"
log_info "(Requer META_ACCESS_TOKEN válido no .env)"
SYNC_RESP=$(curl -s -X POST "$BASE_URL/templates/sync" -H "$AUTH_HEADER")
echo "$SYNC_RESP" | python3 -m json.tool 2>/dev/null

# ---- 7. Listar templates ----
log_step "7. Listar templates aprovados"
TEMPLATES=$(curl -s "$BASE_URL/templates?status=APPROVED" -H "$AUTH_HEADER")
echo "$TEMPLATES" | python3 -m json.tool 2>/dev/null

# ---- 8. Opt-out manual ----
log_step "8. Opt-out manual"
OPTOUT_RESP=$(curl -s -X POST "$BASE_URL/contacts/+5511999990001/opt-out" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"reason": "teste_opt_out"}')
echo "$OPTOUT_RESP" | python3 -m json.tool 2>/dev/null
echo "$OPTOUT_RESP" | grep -q '"success"' && log_ok "Opt-out registrado" || log_fail "Erro no opt-out"

# ---- 9. Verificar webhook ----
log_step "9. Verificar endpoint de webhook (challenge)"
WEBHOOK_TOKEN=$(grep META_WEBHOOK_VERIFY_TOKEN .env 2>/dev/null | cut -d= -f2 | tr -d ' ')
if [ -n "$WEBHOOK_TOKEN" ]; then
  CHALLENGE_RESP=$(curl -s "$BASE_URL/webhook/meta?hub.mode=subscribe&hub.verify_token=$WEBHOOK_TOKEN&hub.challenge=test_challenge_123")
  [ "$CHALLENGE_RESP" = "test_challenge_123" ] && log_ok "Webhook verification OK" || log_fail "Webhook verification falhou: $CHALLENGE_RESP"
else
  log_info "META_WEBHOOK_VERIFY_TOKEN não encontrado no .env, pulando teste"
fi

# ---- 10. Dashboard ----
log_step "10. Dashboard de analytics"
DASHBOARD=$(curl -s "$BASE_URL/analytics/dashboard?days=7" -H "$AUTH_HEADER")
echo "$DASHBOARD" | python3 -m json.tool 2>/dev/null

# ---- 11. Status da fila ----
log_step "11. Status da fila BullMQ"
QUEUE=$(curl -s "$BASE_URL/monitor/queue" -H "$AUTH_HEADER")
echo "$QUEUE" | python3 -m json.tool 2>/dev/null

echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Testes concluídos!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"
