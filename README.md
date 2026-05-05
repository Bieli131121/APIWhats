# WhatsApp Evolution API

API unificada para envio de mensagens WhatsApp via **Evolution API** (open source, sem conta Meta oficial).  
Inclui campanhas por template, agendamento com intervalo, importação CSV, webhooks e controle de opt-in/opt-out.

---

## Stack

- **Node.js + Express** — servidor HTTP
- **PostgreSQL** — banco de dados (Supabase / Neon / Railway recomendados)
- **Redis + BullMQ** — filas de mensagens (Upstash recomendado no Vercel)
- **Evolution API** — integração WhatsApp Web
- **Vercel** — deploy serverless

---

## Estrutura

```
src/
  config/         → database.js, redis.js
  controllers/    → auth, contacts, campaigns, templates, instance, import
  middlewares/    → auth.js (JWT + API Key)
  queues/         → messageQueue.js, schedulerQueue.js
  routes/         → index.js (todas as rotas)
  services/       → evolutionApi.js
  utils/          → logger.js
  webhooks/       → evolutionWebhook.js
  server.js
scripts/
  migrate.js      → cria todas as tabelas
  seed.js         → cria usuário admin
```

---

## Deploy no Vercel

### 1. Pré-requisitos

- Conta [Vercel](https://vercel.com)
- Banco PostgreSQL (recomendo [Neon](https://neon.tech) — grátis)
- Redis (recomendo [Upstash](https://upstash.com) — grátis, funciona no Vercel)
- [Evolution API](https://github.com/EvolutionAPI/evolution-api) rodando (VPS própria)

### 2. Clone e configure

```bash
git clone https://github.com/seu-usuario/whatsapp-evolution-api
cd whatsapp-evolution-api
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Rode as migrations

```bash
npm install
node scripts/migrate.js
node scripts/seed.js
```

### 4. Deploy

```bash
npm install -g vercel
vercel --prod
```

Nas variáveis de ambiente do Vercel, adicione todas as do `.env.example`.

---

## Endpoints

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login → JWT |
| POST | `/api/v1/auth/users` | Criar usuário (admin) |
| POST | `/api/v1/auth/api-key` | Regenerar API Key |

### Contatos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/contacts` | Listar com filtros |
| POST | `/api/v1/contacts` | Criar com opt-in |
| POST | `/api/v1/contacts/import` | Importar em lote |
| POST | `/api/v1/contacts/:phone/opt-out` | Opt-out manual |

### Templates
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/templates` | Listar templates |
| POST | `/api/v1/templates` | Criar template |
| PATCH | `/api/v1/templates/:id/approve` | Aprovar template (admin) |

### Campanhas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/campaigns` | Listar campanhas |
| POST | `/api/v1/campaigns` | Criar campanha |
| POST | `/api/v1/campaigns/:id/launch` | Disparar campanha |
| POST | `/api/v1/campaigns/:id/pause` | Pausar campanha |
| GET | `/api/v1/campaigns/:id/stats` | Estatísticas |

### Mensagens Agendadas
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/messages` | Agendar mensagem avulsa |
| GET | `/api/v1/messages` | Listar mensagens |

### Importação CSV
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/import/csv` | Importar CSV e criar campanha |
| GET | `/api/v1/import/template` | Download CSV modelo |

### WhatsApp / Instância
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/whatsapp/status` | Status de conexão |
| GET | `/api/v1/whatsapp/qrcode` | QR Code (HTML) |
| POST | `/api/v1/whatsapp/setup` | Setup inicial (admin) |

### Monitoramento
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/health` | Status da API |
| GET | `/api/v1/monitor/queue` | Métricas das filas |
| GET | `/api/v1/monitor/logs` | Logs de mensagens |

### Bloqueio
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/block` | Listar bloqueados |
| POST | `/api/v1/block` | Bloquear número |
| DELETE | `/api/v1/block/:phone` | Desbloquear |

### Webhook
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/webhook/evolution` | Receber eventos da Evolution API |

---

## Autenticação

A API aceita dois métodos:

**JWT (Bearer Token):**
```
Authorization: Bearer eyJhbGci...
```

**API Key:**
```
X-API-Key: sua-api-key-aqui
```

---

## Exemplo de uso

### 1. Login
```bash
curl -X POST https://sua-api.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123456"}'
```

### 2. Criar contato
```bash
curl -X POST https://sua-api.vercel.app/api/v1/contacts \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5547999990000",
    "name": "João Silva",
    "opted_in": "true",
    "opted_in_source": "website_form",
    "opted_in_confirmation": "Concordo em receber mensagens via WhatsApp."
  }'
```

### 3. Enviar mensagem avulsa
```bash
curl -X POST https://sua-api.vercel.app/api/v1/messages \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5547999990000",
    "text": "Olá! Esta é uma mensagem de teste.",
    "delay_minutes": 0
  }'
```

### 4. Importar CSV
```bash
curl -X POST https://sua-api.vercel.app/api/v1/import/csv \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_name": "Promoção Junho",
    "message_template": "Olá {{name}}! Temos uma oferta especial para você.",
    "csv_content": "phone,name\n+5547999990001,João\n+5511988880002,Maria"
  }'
```

---

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DB_HOST` | Host do PostgreSQL |
| `DB_NAME` | Nome do banco |
| `DB_USER` | Usuário do banco |
| `DB_PASSWORD` | Senha do banco |
| `REDIS_HOST` | Host do Redis |
| `JWT_SECRET` | Segredo JWT (mín. 32 chars) |
| `EVOLUTION_API_URL` | URL da Evolution API |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_INSTANCE` | Nome da instância |
| `APP_URL` | URL pública da sua API |

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env
# Configure o .env

# Suba PostgreSQL e Redis com Docker:
docker-compose up -d db redis

node scripts/migrate.js
node scripts/seed.js
npm run dev
```
