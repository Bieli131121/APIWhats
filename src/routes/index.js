// src/routes/index.js
// Rotas unificadas da API

const express   = require('express');
const rateLimit = require('express-rate-limit');
const { body }  = require('express-validator');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const authController      = require('../controllers/authController');
const contactsController  = require('../controllers/contactsController');
const campaignsController = require('../controllers/campaignsController');
const templatesController = require('../controllers/templatesController');
const instanceController  = require('../controllers/instanceController');
const importController    = require('../controllers/importController');
const { handleWebhook }   = require('../webhooks/evolutionWebhook');
const { getQueueMetrics } = require('../queues/messageQueue');
const { getQueueStats }   = require('../queues/schedulerQueue');
const { query }           = require('../config/database');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Aguarde 1 hora.' },
});

router.use(apiLimiter);

// ── Health Check ──────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const { pool } = require('../config/database');
  const { redis } = require('../config/redis');

  const dbOk    = await pool.query('SELECT 1').then(() => true).catch(() => false);
  const redisOk = await redis.ping().then((r) => r === 'PONG').catch(() => false);

  res.json({
    status: dbOk && redisOk ? 'healthy' : 'degraded',
    services: { database: dbOk ? 'ok' : 'error', redis: redisOk ? 'ok' : 'error' },
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
  });
});

// ── Autenticação ──────────────────────────────────────────────
router.post('/auth/login', loginLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  authController.login
);
router.post('/auth/users', authenticate, requireAdmin,
  [body('email').isEmail(), body('password').isLength({ min: 8 }), body('name').notEmpty()],
  authController.createUser
);
router.post('/auth/api-key', authenticate, authController.regenerateApiKey);

// ── Contatos ──────────────────────────────────────────────────
router.get('/contacts', authenticate, contactsController.listContacts);
router.post('/contacts', authenticate,
  [
    body('phone').notEmpty().withMessage('Telefone é obrigatório'),
    body('opted_in').equals('true').withMessage('opted_in deve ser true'),
    body('opted_in_source').notEmpty().withMessage('Informe a origem do consentimento'),
    body('opted_in_confirmation').notEmpty().withMessage('Informe o texto exibido ao usuário'),
  ],
  contactsController.createContact
);
router.post('/contacts/import', authenticate, contactsController.importContacts);
router.post('/contacts/:phone/opt-out', authenticate, contactsController.optOut);

// ── Templates ─────────────────────────────────────────────────
router.get('/templates', authenticate, templatesController.listTemplates);
router.post('/templates', authenticate,
  [body('name').notEmpty(), body('category').notEmpty(), body('body_text').notEmpty()],
  templatesController.createTemplate
);
router.patch('/templates/:id/approve', authenticate, requireAdmin, templatesController.approveTemplate);

// ── Campanhas (template-based) ────────────────────────────────
router.get('/campaigns',         authenticate, campaignsController.listCampaigns);
router.post('/campaigns',        authenticate,
  [body('name').notEmpty(), body('template_id').isUUID()],
  campaignsController.createCampaign
);
router.get('/campaigns/:id/stats',  authenticate, campaignsController.getCampaignStats);
router.post('/campaigns/:id/launch', authenticate, campaignsController.launchCampaign);
router.post('/campaigns/:id/pause',  authenticate, campaignsController.pauseCampaign);

// ── Mensagens & Campanhas agendadas (scheduler) ───────────────
router.post('/messages',    authenticate, campaignsController.scheduleOne);
router.get('/messages',     authenticate, campaignsController.listMessages);
router.get('/scheduled-campaigns/:id', authenticate, campaignsController.getCampaign);
router.delete('/scheduled-campaigns/:id', authenticate, campaignsController.cancelCampaign);

// ── Importação CSV ────────────────────────────────────────────
router.post('/import/csv',     authenticate, importController.importCSV);
router.get('/import/template', importController.getCSVTemplate);

// ── Bloqueio de números ───────────────────────────────────────
router.get('/block', authenticate, async (req, res) => {
  const r = await query(`SELECT * FROM blocked_phones ORDER BY blocked_at DESC LIMIT 100`);
  res.json({ blocked: r.rows });
});
router.post('/block', authenticate, async (req, res) => {
  const { phone, reason = 'manual' } = req.body;
  if (!phone) return res.status(400).json({ error: 'Informe phone.' });
  const cleaned = phone.replace(/\D/g, '');
  await query(
    `INSERT INTO blocked_phones (phone, reason) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET reason = $2, blocked_at = NOW()`,
    [cleaned, reason]
  );
  await query(
    `UPDATE scheduled_messages SET status = 'cancelled' WHERE phone = $1 AND status = 'pending'`,
    [cleaned]
  );
  res.json({ success: true, phone: cleaned, blocked: true });
});
router.delete('/block/:phone', authenticate, async (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '');
  await query(`DELETE FROM blocked_phones WHERE phone = $1`, [phone]);
  res.json({ success: true, phone, unblocked: true });
});

// ── Monitoramento ─────────────────────────────────────────────
router.get('/monitor/queue', authenticate, async (req, res) => {
  const [msgQueue, schedQueue] = await Promise.all([getQueueMetrics(), getQueueStats()]);
  res.json({ message_queue: msgQueue, scheduler_queue: schedQueue });
});

router.get('/monitor/logs', authenticate, async (req, res) => {
  const { status, campaign_id, limit = 50 } = req.query;
  const conditions = [];
  const params = [];
  let i = 1;

  if (status)      { conditions.push(`m.status = $${i++}`);      params.push(status); }
  if (campaign_id) { conditions.push(`m.campaign_id = $${i++}`); params.push(campaign_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT m.id, m.phone_to, m.status, m.meta_message_id,
            m.sent_at, m.delivered_at, m.read_at, m.failed_at,
            m.error_code, m.error_message,
            c.name as contact_name, camp.name as campaign_name
     FROM messages m
     LEFT JOIN contacts c ON c.id = m.contact_id
     LEFT JOIN campaigns camp ON camp.id = m.campaign_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${i}`,
    [...params, parseInt(limit)]
  );
  res.json({ messages: result.rows });
});

// ── WhatsApp / Instância ──────────────────────────────────────
router.get('/whatsapp/status',  authenticate, instanceController.getStatus);
router.get('/whatsapp/qrcode',  instanceController.getQR);
router.post('/whatsapp/setup',  authenticate, requireAdmin, instanceController.setupInstance);

// ── Webhook Evolution API ─────────────────────────────────────
router.post('/webhook/evolution', handleWebhook);

module.exports = router;
