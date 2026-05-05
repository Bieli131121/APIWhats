// src/controllers/campaignsController.js
// Campanhas de mensagens — Evolution API + Scheduler

const { query, getClient } = require('../config/database');
const { enqueueCampaign } = require('../queues/messageQueue');
const { enqueueBatch } = require('../queues/schedulerQueue');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/** Lista campanhas com paginação. */
const listCampaigns = async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (page - 1) * limit;

  try {
    let campaigns = [];

    if (!type || type === 'template') {
      const r = await query(
        `SELECT c.*, t.name as template_name, 'template' as type
         FROM campaigns c
         LEFT JOIN message_templates t ON t.id = c.template_id
         ORDER BY c.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      campaigns = [...campaigns, ...r.rows];
    }

    if (!type || type === 'scheduled') {
      const r = await query(
        `SELECT *, 'scheduled' as type FROM scheduler_campaigns
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      campaigns = [...campaigns, ...r.rows];
    }

    campaigns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ campaigns: campaigns.slice(0, parseInt(limit)) });
  } catch (error) {
    logger.error('Erro ao listar campanhas:', error);
    res.status(500).json({ error: 'Erro ao listar campanhas' });
  }
};

/** Cria campanha baseada em template (modo rascunho). */
const createCampaign = async (req, res) => {
  const { name, description, template_id, scheduled_at, target_tags } = req.body;
  try {
    const templateResult = await query(
      `SELECT id, name, status, variables_count FROM message_templates WHERE id = $1`,
      [template_id]
    );

    if (!templateResult.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });

    if (templateResult.rows[0].status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Template não aprovado',
        message: `Status atual: ${templateResult.rows[0].status}. Aprove o template antes de criar a campanha.`,
      });
    }

    const result = await query(
      `INSERT INTO campaigns (name, description, template_id, created_by, scheduled_at, target_tags)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, description, template_id, req.user.id, scheduled_at || null, target_tags || []]
    );
    res.status(201).json({ success: true, campaign: result.rows[0] });
  } catch (error) {
    logger.error('Erro ao criar campanha:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
};

/** Dispara campanha por template. */
const launchCampaign = async (req, res) => {
  const { id } = req.params;
  const { variables_map = {} } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const campaignResult = await client.query(
      `SELECT c.*, t.name as template_name, t.language
       FROM campaigns c
       JOIN message_templates t ON t.id = c.template_id
       WHERE c.id = $1 FOR UPDATE`,
      [id]
    );

    const campaign = campaignResult.rows[0];
    if (!campaign) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (!['draft', 'paused'].includes(campaign.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Campanha no status "${campaign.status}" não pode ser disparada` });
    }

    let contactsQuery = `
      SELECT id, phone, name, custom_data
      FROM contacts
      WHERE opted_in = true AND opted_out = false AND is_blocked = false`;
    const contactsParams = [];

    if (campaign.target_tags?.length) {
      contactsQuery += ` AND tags && $1`;
      contactsParams.push(campaign.target_tags);
    }

    const contactsResult = await client.query(contactsQuery, contactsParams);
    const contacts = contactsResult.rows;

    if (contacts.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nenhum contato elegível com opt-in ativo' });
    }

    const messageValues = contacts.map((c) => {
      const variables = buildVariables(variables_map, c);
      return `('${uuidv4()}', '${id}', '${c.id}', '${campaign.template_id}', '${c.phone}', '${JSON.stringify(variables).replace(/'/g, "''")}')`;
    });

    await client.query(
      `INSERT INTO messages (id, campaign_id, contact_id, template_id, phone_to, template_variables)
       VALUES ${messageValues.join(',')}`
    );

    await client.query(
      `UPDATE campaigns SET status = 'running', started_at = NOW(), total_contacts = $1 WHERE id = $2`,
      [contacts.length, id]
    );

    await client.query('COMMIT');

    const messagesResult = await query(
      `SELECT id, phone_to, template_variables FROM messages WHERE campaign_id = $1 AND status = 'queued'`,
      [id]
    );

    const queuePayloads = messagesResult.rows.map((m) => ({
      messageId: m.id,
      phone: m.phone_to,
      templateName: campaign.template_name,
      language: campaign.language || 'pt_BR',
      variables: m.template_variables,
      campaignId: id,
    }));

    await enqueueCampaign(queuePayloads);

    logger.info(`Campanha ${id} disparada: ${contacts.length} mensagens enfileiradas`);
    res.json({
      success: true,
      campaign_id: id,
      messages_queued: contacts.length,
      estimated_completion_minutes: Math.ceil(contacts.length / parseInt(process.env.RATE_LIMIT_MESSAGES_PER_MINUTE || 80)),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Erro ao disparar campanha:', error);
    res.status(500).json({ error: 'Erro ao disparar campanha' });
  } finally {
    client.release();
  }
};

/** Pausa campanha em andamento. */
const pauseCampaign = async (req, res) => {
  const { id } = req.params;
  await query(`UPDATE campaigns SET status = 'paused' WHERE id = $1 AND status = 'running'`, [id]);
  res.json({ success: true });
};

/** Estatísticas detalhadas da campanha. */
const getCampaignStats = async (req, res) => {
  const { id } = req.params;
  try {
    const [campaign, statusBreakdown] = await Promise.all([
      query(`SELECT * FROM campaigns WHERE id = $1`, [id]),
      query(`SELECT status, COUNT(*) as count FROM messages WHERE campaign_id = $1 GROUP BY status`, [id]),
    ]);

    if (!campaign.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada' });

    res.json({ campaign: campaign.rows[0], breakdown: statusBreakdown.rows });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
};

// ─── Scheduler: mensagem avulsa ──────────────────────────────

/** Agenda uma mensagem avulsa. */
const scheduleOne = async (req, res) => {
  const { phone, text, delay_minutes = 0 } = req.body;

  if (!phone || !text) return res.status(400).json({ error: 'phone e text são obrigatórios' });

  try {
    const id = uuidv4();
    const campaignId = null;

    await query(
      `INSERT INTO scheduled_messages (id, phone, text, status)
       VALUES ($1, $2, $3, 'pending')`,
      [id, phone.replace(/\D/g, ''), text]
    );

    const delayMs = delay_minutes * 60 * 1000;
    const { enqueueMessage } = require('../queues/schedulerQueue');
    const job = await enqueueMessage({ messageId: id, phone, text, campaignId, delayMs });

    logger.info(`Mensagem avulsa agendada: ${id}`);
    res.status(201).json({ success: true, message_id: id, scheduled_at: job.scheduledAt });
  } catch (error) {
    logger.error('Erro ao agendar mensagem:', error);
    res.status(500).json({ error: 'Erro ao agendar mensagem' });
  }
};

/** Lista mensagens agendadas. */
const listMessages = async (req, res) => {
  const { status, limit = 50 } = req.query;
  const params = [];
  let where = '';
  if (status) { where = 'WHERE status = $1'; params.push(status); }

  const result = await query(
    `SELECT * FROM scheduled_messages ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, parseInt(limit)]
  );
  res.json({ messages: result.rows });
};

/** Cancela campanha agendada. */
const cancelCampaign = async (req, res) => {
  const { id } = req.params;
  try {
    const { cancelCampaignJobs } = require('../queues/schedulerQueue');
    const cancelled = await cancelCampaignJobs(id);
    await query(`UPDATE scheduler_campaigns SET status = 'cancelled' WHERE id = $1`, [id]);
    res.json({ success: true, cancelled });
  } catch (error) {
    logger.error('Erro ao cancelar campanha:', error);
    res.status(500).json({ error: 'Erro ao cancelar campanha' });
  }
};

/** getCampaign por id (scheduler). */
const getCampaign = async (req, res) => {
  const { id } = req.params;
  const [camp, msgs] = await Promise.all([
    query(`SELECT * FROM scheduler_campaigns WHERE id = $1`, [id]),
    query(
      `SELECT id, phone, text, status, scheduled_for, sent_at, failed_at, error_message
       FROM scheduled_messages WHERE campaign_id = $1 ORDER BY created_at`,
      [id]
    ),
  ]);
  if (!camp.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada' });
  res.json({ campaign: camp.rows[0], messages: msgs.rows });
};

const buildVariables = (variables_map, contact) => {
  if (!variables_map || Object.keys(variables_map).length === 0) return {};
  const result = {};
  for (const [section, values] of Object.entries(variables_map)) {
    result[section] = values.map((v) => {
      if (typeof v === 'string' && v.startsWith('@')) {
        const field = v.slice(1);
        return contact[field] || contact.custom_data?.[field] || v;
      }
      return v;
    });
  }
  return result;
};

module.exports = {
  listCampaigns, createCampaign, launchCampaign, pauseCampaign,
  getCampaignStats, scheduleOne, listMessages, cancelCampaign, getCampaign,
};
