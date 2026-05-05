// src/controllers/messagesController.js
// Envio de mensagens individuais (fora de campanhas)
// Útil para: notificações transacionais, confirmações de pedido, OTPs, etc.

const { query } = require('../config/database');
const { sendTemplateMessage, buildComponents } = require('../services/metaApi');
const { enqueueMessage } = require('../queues/messageQueue');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Envia uma mensagem individual para um contato.
 * O contato DEVE ter opted_in = true.
 *
 * Body:
 * {
 *   phone: "+5511999990000",
 *   template_name: "confirmacao_pedido",
 *   language: "pt_BR",
 *   variables: {
 *     body: ["João", "Pedido #1234", "R$ 150,00"]
 *   },
 *   send_immediately: true   // false = enfileira (default)
 * }
 */
const sendMessage = async (req, res) => {
  const { phone, template_name, language = 'pt_BR', variables = {}, send_immediately = false } = req.body;

  if (!phone || !template_name) {
    return res.status(400).json({ error: 'phone e template_name são obrigatórios' });
  }

  try {
    // Verifica se o contato existe e tem opt-in ativo
    const contactResult = await query(
      `SELECT id, opted_in, opted_out, is_blocked FROM contacts WHERE phone = $1`,
      [phone]
    );

    const contact = contactResult.rows[0];

    if (!contact) {
      return res.status(404).json({
        error: 'Contato não encontrado',
        message: 'Cadastre o contato com opt-in antes de enviar mensagens',
      });
    }

    if (!contact.opted_in || contact.opted_out) {
      return res.status(403).json({
        error: 'Contato sem consentimento',
        message: 'Este contato não possui opt-in ativo ou fez opt-out',
      });
    }

    if (contact.is_blocked) {
      return res.status(403).json({
        error: 'Contato bloqueado',
        message: 'Este número foi marcado como inválido pela Meta',
      });
    }

    // Verifica se o template existe e está aprovado
    const templateResult = await query(
      `SELECT id, status FROM message_templates WHERE name = $1`,
      [template_name]
    );

    const template = templateResult.rows[0];

    if (!template) {
      return res.status(404).json({ error: `Template "${template_name}" não encontrado no banco` });
    }

    if (template.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Template não aprovado',
        message: `Status atual: ${template.status}`,
      });
    }

    // Cria registro da mensagem
    const messageId = uuidv4();
    await query(
      `INSERT INTO messages (id, contact_id, template_id, phone_to, template_variables, status)
       VALUES ($1, $2, $3, $4, $5, 'queued')`,
      [messageId, contact.id, template.id, phone, JSON.stringify(variables)]
    );

    if (send_immediately) {
      // Envio direto (síncrono) — útil para OTP e notificações urgentes
      const components = buildComponents(variables);
      const result = await sendTemplateMessage(phone, template_name, language, components);

      await query(
        `UPDATE messages SET status = 'sent', meta_message_id = $1, sent_at = NOW() WHERE id = $2`,
        [result.wamid, messageId]
      );

      return res.json({
        success: true,
        message_id: messageId,
        wamid: result.wamid,
        mode: 'immediate',
      });
    } else {
      // Enfileira para envio respeitando rate limit
      const jobId = await enqueueMessage({
        messageId,
        phone,
        templateName: template_name,
        language,
        variables,
        campaignId: null,
      });

      return res.json({
        success: true,
        message_id: messageId,
        job_id: jobId,
        mode: 'queued',
      });
    }
  } catch (error) {
    logger.error('Erro ao enviar mensagem individual:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};

/**
 * Busca o status de uma mensagem específica.
 */
const getMessageStatus = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT m.id, m.meta_message_id, m.phone_to, m.status,
            m.queued_at, m.sent_at, m.delivered_at, m.read_at, m.failed_at,
            m.error_code, m.error_message, m.attempts,
            t.name as template_name,
            c.name as contact_name
     FROM messages m
     LEFT JOIN message_templates t ON t.id = m.template_id
     LEFT JOIN contacts c ON c.id = m.contact_id
     WHERE m.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'Mensagem não encontrada' });
  }

  // Calcula tempo até entrega (se disponível)
  const msg = result.rows[0];
  if (msg.sent_at && msg.delivered_at) {
    msg.delivery_time_seconds = Math.round(
      (new Date(msg.delivered_at) - new Date(msg.sent_at)) / 1000
    );
  }

  res.json({ message: msg });
};

/**
 * Re-enfileira uma mensagem que falhou.
 */
const retryMessage = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT m.*, t.name as template_name
     FROM messages m
     JOIN message_templates t ON t.id = m.template_id
     WHERE m.id = $1 AND m.status = 'failed'`,
    [id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'Mensagem não encontrada ou não está em status failed' });
  }

  const msg = result.rows[0];

  // Reset status
  await query(
    `UPDATE messages SET status = 'queued', error_code = NULL, error_message = NULL WHERE id = $1`,
    [id]
  );

  const jobId = await enqueueMessage({
    messageId: msg.id,
    phone: msg.phone_to,
    templateName: msg.template_name,
    language: 'pt_BR',
    variables: msg.template_variables || {},
    campaignId: msg.campaign_id,
  });

  res.json({ success: true, job_id: jobId });
};

module.exports = { sendMessage, getMessageStatus, retryMessage };
