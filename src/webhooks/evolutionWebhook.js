// src/webhooks/evolutionWebhook.js
// Handler para webhooks da Evolution API

const { query } = require('../config/database');
const logger = require('../utils/logger');

const OPT_OUT_KEYWORDS = ['sair', 'stop', 'parar', 'cancelar', 'remover', 'descadastrar', 'unsubscribe', '0'];

/** POST /api/v1/webhook/evolution */
const handleWebhook = async (req, res) => {
  res.status(200).send('OK'); // responde imediatamente

  const body  = req.body;
  const event = body.event;

  logger.info(`Evolution Webhook: evento "${event}"`);

  try {
    await query(
      `INSERT INTO webhook_logs (event_type, raw_payload) VALUES ($1, $2)`,
      [event, JSON.stringify(body)]
    ).catch(() => {});

    if (event === 'messages.upsert')   await processIncomingMessage(body);
    if (event === 'messages.update')   await processMessageStatus(body);
    if (event === 'connection.update') await processConnectionUpdate(body);
  } catch (err) {
    logger.error('Evolution Webhook: erro ao processar:', err);
  }
};

const processIncomingMessage = async (body) => {
  const data = body.data;
  if (data?.key?.fromMe) return;

  const phone = data?.key?.remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const messageText = (
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    ''
  ).toLowerCase().trim();

  if (!phone) return;

  logger.info(`Webhook: mensagem de ${phone}: "${messageText}"`);

  if (OPT_OUT_KEYWORDS.includes(messageText)) {
    await processOptOutByReply(phone);
  }
};

const processMessageStatus = async (body) => {
  const updates = body.data;
  if (!Array.isArray(updates)) return;

  for (const update of updates) {
    const messageId = update?.key?.id;
    const status    = update?.update?.status;
    if (!messageId || !status) continue;

    const statusMap = {
      'DELIVERY_ACK': 'delivered',
      'READ':         'read',
      'PLAYED':       'read',
      'ERROR':        'failed',
    };

    const normalizedStatus = statusMap[status];
    if (!normalizedStatus) continue;

    const timeColumn = { delivered: 'delivered_at', read: 'read_at', failed: 'failed_at' }[normalizedStatus];

    logger.info(`Webhook: status "${normalizedStatus}" para msg ${messageId}`);

    const result = await query(
      `UPDATE messages
       SET status = $1, status_updated_at = NOW(), ${timeColumn} = NOW()
       WHERE meta_message_id = $2
       RETURNING campaign_id`,
      [normalizedStatus, messageId]
    ).catch((e) => logger.error('Erro ao atualizar status:', e));

    if (result?.rows[0]?.campaign_id && ['delivered', 'read', 'failed'].includes(normalizedStatus)) {
      const col = `${normalizedStatus}_count`;
      await query(
        `UPDATE campaigns SET ${col} = ${col} + 1 WHERE id = $1`,
        [result.rows[0].campaign_id]
      ).catch(() => {});
    }
  }
};

const processConnectionUpdate = async (body) => {
  const state = body.data?.state;
  logger.info(`Webhook: conexão → ${state}`);
  if (state === 'close') logger.warn('⚠️  WhatsApp desconectado! Acesse /api/v1/whatsapp/qrcode para reconectar.');
  if (state === 'open')  logger.info('✅ WhatsApp conectado com sucesso!');
};

const processOptOutByReply = async (phone) => {
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
  const result = await query(
    `UPDATE contacts SET opted_out = true, opted_out_at = NOW(), opted_out_reason = 'reply_keyword'
     WHERE phone = $1 RETURNING id`,
    [formattedPhone]
  );

  if (result?.rowCount > 0) {
    await query(
      `INSERT INTO consent_audit_log (contact_id, action, source, details)
       VALUES ($1, 'OPT_OUT', 'whatsapp_reply', 'Usuário respondeu palavra-chave de opt-out')`,
      [result.rows[0].id]
    );
    logger.info(`Opt-out automático: ${formattedPhone}`);
  }
};

module.exports = { handleWebhook };
