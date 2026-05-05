// src/webhooks/metaWebhook.js
// Handler para webhooks da Meta WhatsApp Cloud API
//
// A Meta envia eventos para este endpoint:
//  - Status de entrega das mensagens (sent, delivered, read, failed)
//  - Mensagens recebidas (respostas dos usuários, como "SAIR")
//  - Atualizações de qualidade do número

const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Palavras-chave que disparam opt-out automático
// Adapte para seu idioma e contexto
const OPT_OUT_KEYWORDS = ['sair', 'stop', 'parar', 'cancelar', 'remover', 'descadastrar', 'unsubscribe', '0'];

/**
 * GET /webhook/meta
 * Verificação do webhook pela Meta (challenge handshake).
 * Necessário para ativar o webhook no painel de desenvolvedores.
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook Meta: verificação bem-sucedida');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook Meta: falha na verificação', { mode, token });
  res.status(403).json({ error: 'Forbidden' });
};

/**
 * POST /webhook/meta
 * Recebe eventos da Meta. Deve retornar 200 rapidamente e processar em background.
 */
const handleWebhook = async (req, res) => {
  // Retorna 200 imediatamente para a Meta (evita reenvios desnecessários)
  res.status(200).send('OK');

  const body = req.body;

  // Valida assinatura HMAC para segurança (garante que veio da Meta)
  if (!validateSignature(req)) {
    logger.warn('Webhook Meta: assinatura inválida - possível request malicioso');
    return; // Já respondeu 200, apenas ignora
  }

  // Salva payload bruto para auditoria e debugging
  try {
    await query(
      `INSERT INTO webhook_logs (event_type, raw_payload) VALUES ($1, $2)`,
      [body.object, JSON.stringify(body)]
    );
  } catch (e) {
    logger.error('Erro ao salvar webhook log:', e);
  }

  if (body.object !== 'whatsapp_business_account') {
    return;
  }

  // Processa cada entrada do payload
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;

      // --- Processa status de mensagens ---
      for (const status of value.statuses || []) {
        await processMessageStatus(status);
      }

      // --- Processa mensagens recebidas ---
      for (const message of value.messages || []) {
        await processIncomingMessage(message, value.contacts?.[0]);
      }
    }
  }
};

/**
 * Atualiza o status de uma mensagem no banco com base no webhook.
 * Eventos: sent, delivered, read, failed
 */
const processMessageStatus = async (statusData) => {
  const { id: wamid, status, timestamp, errors } = statusData;

  logger.info(`Webhook: status "${status}" para wamid ${wamid}`);

  const statusColumnMap = {
    sent: 'sent_at',
    delivered: 'delivered_at',
    read: 'read_at',
    failed: 'failed_at',
  };

  const timeColumn = statusColumnMap[status];
  if (!timeColumn) return;

  const errorCode = errors?.[0]?.code?.toString();
  const errorMessage = errors?.[0]?.title;

  // Atualiza mensagem pelo wamid (ID da Meta)
  const result = await query(
    `UPDATE messages
     SET status = $1,
         status_updated_at = NOW(),
         ${timeColumn} = to_timestamp($2),
         error_code = COALESCE($3, error_code),
         error_message = COALESCE($4, error_message)
     WHERE meta_message_id = $5
     RETURNING campaign_id`,
    [status, parseInt(timestamp), errorCode, errorMessage, wamid]
  ).catch((e) => logger.error('Erro ao atualizar status da mensagem:', e));

  // Atualiza contadores da campanha
  if (result?.rows[0]?.campaign_id && ['delivered', 'read', 'failed'].includes(status)) {
    const counterColumn = `${status}_count`;
    await query(
      `UPDATE campaigns SET ${counterColumn} = ${counterColumn} + 1 WHERE id = $1`,
      [result.rows[0].campaign_id]
    ).catch(() => {});
  }

  // Se falhou por número inválido, marca contato como bloqueado
  if (status === 'failed' && ['131026', '131047'].includes(errorCode)) {
    await query(
      `UPDATE contacts SET is_blocked = true
       WHERE phone = (SELECT phone_to FROM messages WHERE meta_message_id = $1)`,
      [wamid]
    ).catch(() => {});
  }
};

/**
 * Processa mensagens recebidas dos usuários.
 * Principal uso: detectar "SAIR" e fazer opt-out automático.
 */
const processIncomingMessage = async (message, contactInfo) => {
  const { from: phone, type, text, timestamp } = message;
  const messageText = text?.body?.toLowerCase().trim() || '';

  logger.info(`Webhook: mensagem recebida de ${phone}: "${messageText}"`);

  // Verifica se é um comando de opt-out
  if (OPT_OUT_KEYWORDS.includes(messageText)) {
    await processOptOutByReply(phone);
    return;
  }

  // Aqui você pode adicionar lógica para:
  // - Responder automaticamente
  // - Encaminhar para sistema de suporte
  // - Registrar respostas de campanhas (NPS, confirmações, etc.)
};

/**
 * Processa opt-out automático quando usuário responde palavra-chave.
 */
const processOptOutByReply = async (phone) => {
  // Formato da Meta não tem +, adiciona para padronizar
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const result = await query(
    `UPDATE contacts
     SET opted_out = true, opted_out_at = NOW(), opted_out_reason = 'reply_keyword'
     WHERE phone = $1
     RETURNING id`,
    [formattedPhone]
  );

  if (result.rowCount > 0) {
    await query(
      `INSERT INTO consent_audit_log (contact_id, action, source, details)
       VALUES ($1, 'OPT_OUT', 'whatsapp_reply', 'Usuário respondeu palavra-chave de opt-out')`,
      [result.rows[0].id]
    );
    logger.info(`Opt-out automático processado para ${formattedPhone}`);
  } else {
    logger.warn(`Opt-out: contato não encontrado para ${formattedPhone}`);
  }
};

/**
 * Valida a assinatura HMAC-SHA256 do webhook da Meta.
 * Isso garante que o request veio realmente da Meta e não de terceiros.
 */
const validateSignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Webhook: header x-hub-signature-256 ausente');
    return false; // Em produção, retorne false. Em dev, pode ser true para facilitar testes.
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  const isValid = `sha256=${expectedSignature}` === signature;
  if (!isValid) {
    logger.warn('Webhook: assinatura HMAC inválida');
  }
  return isValid;
};

module.exports = { verifyWebhook, handleWebhook };
