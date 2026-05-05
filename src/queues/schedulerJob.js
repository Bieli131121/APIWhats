// src/queues/schedulerJob.js
// Job que verifica campanhas agendadas e dispara no horário certo
// Roda a cada minuto via setInterval (ou substitua por node-cron em produção)

const { query } = require('../config/database');
const { enqueueCampaign } = require('./messageQueue');
const { buildComponents } = require('../services/metaApi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Verifica campanhas com scheduled_at no passado e status 'draft'.
 * Dispara automaticamente.
 */
const processScheduledCampaigns = async () => {
  try {
    // Busca campanhas prontas para disparar
    const pendingResult = await query(`
      SELECT c.id, c.name, t.name AS template_name, t.language, c.target_tags
      FROM campaigns c
      JOIN message_templates t ON t.id = c.template_id
      WHERE c.status = 'draft'
        AND c.scheduled_at IS NOT NULL
        AND c.scheduled_at <= NOW()
    `);

    if (pendingResult.rows.length === 0) return;

    logger.info(`Scheduler: ${pendingResult.rows.length} campanha(s) prontas para disparo`);

    for (const campaign of pendingResult.rows) {
      try {
        await launchScheduledCampaign(campaign);
      } catch (err) {
        logger.error(`Scheduler: erro ao disparar campanha ${campaign.id}:`, err.message);
        await query(
          `UPDATE campaigns SET status = 'failed' WHERE id = $1`,
          [campaign.id]
        );
      }
    }
  } catch (error) {
    logger.error('Scheduler: erro geral:', error.message);
  }
};

const launchScheduledCampaign = async (campaign) => {
  // Marca como running para evitar duplo disparo (race condition)
  const updated = await query(
    `UPDATE campaigns SET status = 'running', started_at = NOW()
     WHERE id = $1 AND status = 'draft'
     RETURNING id`,
    [campaign.id]
  );

  if (updated.rowCount === 0) {
    logger.warn(`Scheduler: campanha ${campaign.id} já foi processada por outro worker`);
    return;
  }

  // Busca contatos elegíveis
  let contactsQuery = `
    SELECT id, phone, name, custom_data FROM contacts
    WHERE opted_in = true AND opted_out = false AND is_blocked = false`;
  const params = [];

  if (campaign.target_tags?.length) {
    contactsQuery += ` AND tags && $1`;
    params.push(campaign.target_tags);
  }

  const contacts = await query(contactsQuery, params);

  if (contacts.rows.length === 0) {
    await query(`UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`, [campaign.id]);
    logger.warn(`Scheduler: campanha ${campaign.id} sem contatos elegíveis`);
    return;
  }

  // Cria mensagens em lote
  const values = contacts.rows.map((c) =>
    `('${uuidv4()}', '${campaign.id}', '${c.id}', (SELECT template_id FROM campaigns WHERE id = '${campaign.id}'), '${c.phone}', '{}')`
  );

  await query(
    `INSERT INTO messages (id, campaign_id, contact_id, template_id, phone_to, template_variables)
     VALUES ${values.join(',')}`
  );

  await query(
    `UPDATE campaigns SET total_contacts = $1 WHERE id = $2`,
    [contacts.rows.length, campaign.id]
  );

  // Enfileira
  const payloads = contacts.rows.map((c) => ({
    messageId: uuidv4(),
    phone: c.phone,
    templateName: campaign.template_name,
    language: campaign.language || 'pt_BR',
    variables: {},
    campaignId: campaign.id,
  }));

  await enqueueCampaign(payloads);
  logger.info(`Scheduler: campanha "${campaign.name}" disparada — ${contacts.rows.length} msgs`);
};

/**
 * Inicia o scheduler. Chame no server.js após a inicialização.
 * Em produção considere usar node-cron ou uma fila separada no BullMQ.
 */
const startScheduler = () => {
  const INTERVAL_MS = 60 * 1000; // verifica a cada 1 minuto
  logger.info('Scheduler: iniciado (intervalo: 1 minuto)');
  processScheduledCampaigns(); // executa imediatamente ao iniciar
  return setInterval(processScheduledCampaigns, INTERVAL_MS);
};

module.exports = { startScheduler, processScheduledCampaigns };
