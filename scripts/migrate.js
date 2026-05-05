// scripts/migrate.js
// Cria todas as tabelas do banco de dados
// Execute: node scripts/migrate.js

require('dotenv').config();
const { pool } = require('../src/config/database');
const logger   = require('../src/utils/logger');

const migrations = [
  // ── Usuários da API ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS api_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key       VARCHAR(64) UNIQUE,
    role          VARCHAR(50) DEFAULT 'operator',
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Contatos (opt-in obrigatório) ─────────────────────────
  `CREATE TABLE IF NOT EXISTS contacts (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone                  VARCHAR(20) UNIQUE NOT NULL,
    name                   VARCHAR(255),
    email                  VARCHAR(255),
    opted_in               BOOLEAN DEFAULT false NOT NULL,
    opted_in_at            TIMESTAMPTZ,
    opted_in_source        VARCHAR(100),
    opted_in_ip            VARCHAR(45),
    opted_in_user_agent    TEXT,
    opted_in_confirmation  TEXT,
    opted_out              BOOLEAN DEFAULT false NOT NULL,
    opted_out_at           TIMESTAMPTZ,
    opted_out_reason       VARCHAR(255),
    custom_data            JSONB DEFAULT '{}',
    tags                   TEXT[] DEFAULT '{}',
    is_blocked             BOOLEAN DEFAULT false,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Templates ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS message_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) UNIQUE NOT NULL,
    meta_template_id VARCHAR(255),
    category         VARCHAR(100) NOT NULL,
    language         VARCHAR(10) DEFAULT 'pt_BR',
    status           VARCHAR(50) DEFAULT 'PENDING',
    header_type      VARCHAR(50),
    header_content   TEXT,
    body_text        TEXT NOT NULL,
    footer_text      TEXT,
    buttons          JSONB DEFAULT '[]',
    variables_count  INT DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Campanhas (template-based) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS campaigns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    template_id      UUID REFERENCES message_templates(id),
    created_by       UUID REFERENCES api_users(id),
    status           VARCHAR(50) DEFAULT 'draft',
    scheduled_at     TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    total_contacts   INT DEFAULT 0,
    sent_count       INT DEFAULT 0,
    delivered_count  INT DEFAULT 0,
    read_count       INT DEFAULT 0,
    failed_count     INT DEFAULT 0,
    target_tags      TEXT[] DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Mensagens individuais ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID REFERENCES campaigns(id),
    contact_id          UUID REFERENCES contacts(id),
    template_id         UUID REFERENCES message_templates(id),
    meta_message_id     VARCHAR(255) UNIQUE,
    phone_to            VARCHAR(20) NOT NULL,
    template_variables  JSONB DEFAULT '{}',
    status              VARCHAR(50) DEFAULT 'queued',
    status_updated_at   TIMESTAMPTZ,
    error_code          VARCHAR(50),
    error_message       TEXT,
    queued_at           TIMESTAMPTZ DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    attempts            INT DEFAULT 0,
    next_retry_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Campanhas agendadas (scheduler) ──────────────────────
  `CREATE TABLE IF NOT EXISTS scheduler_campaigns (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    status       VARCHAR(50) DEFAULT 'draft',
    total_count  INT DEFAULT 0,
    sent_count   INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Mensagens agendadas (scheduler) ──────────────────────
  `CREATE TABLE IF NOT EXISTS scheduled_messages (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id          UUID REFERENCES scheduler_campaigns(id),
    phone                VARCHAR(20) NOT NULL,
    text                 TEXT NOT NULL,
    status               VARCHAR(50) DEFAULT 'pending',
    scheduled_for        TIMESTAMPTZ,
    started_at           TIMESTAMPTZ,
    sent_at              TIMESTAMPTZ,
    failed_at            TIMESTAMPTZ,
    evolution_message_id VARCHAR(255),
    error_message        TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Números bloqueados ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS blocked_phones (
    phone      VARCHAR(20) PRIMARY KEY,
    reason     VARCHAR(255),
    blocked_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Log de webhooks ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS webhook_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(100),
    raw_payload JSONB NOT NULL,
    processed   BOOLEAN DEFAULT false,
    error       TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Auditoria de consentimento ────────────────────────────
  `CREATE TABLE IF NOT EXISTS consent_audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id   UUID REFERENCES contacts(id),
    action       VARCHAR(50) NOT NULL,
    source       VARCHAR(100),
    details      TEXT,
    performed_by UUID REFERENCES api_users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Índices ───────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_contacts_phone       ON contacts(phone)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_opted       ON contacts(opted_in, opted_out)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_campaign    ON messages(campaign_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_meta_id     ON messages(meta_message_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_status      ON messages(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sched_msgs_campaign  ON scheduled_messages(campaign_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sched_msgs_status    ON scheduled_messages(status)`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_logs         ON webhook_logs(received_at DESC)`,
];

async function runMigrations() {
  logger.info('Iniciando migrations...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const sql of migrations) {
      const tableName = sql.match(/TABLE IF NOT EXISTS (\w+)|INDEX IF NOT EXISTS (\w+)/)?.[1] || '(index)';
      logger.info(`  → ${tableName}`);
      await client.query(sql);
    }

    await client.query('COMMIT');
    logger.info('✅ Migrations concluídas com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erro nas migrations:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(() => process.exit(1));
