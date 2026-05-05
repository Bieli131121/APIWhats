// src/services/evolutionApi.js
// Integração com Evolution API (open source, sem conta Meta)
// Docs: https://doc.evolution-api.com

const axios = require('axios');
const logger = require('../utils/logger');

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY  = process.env.EVOLUTION_API_KEY  || '';
const INSTANCE_NAME      = process.env.EVOLUTION_INSTANCE  || 'minha-instancia';

const evolutionClient = axios.create({
  baseURL: EVOLUTION_BASE_URL,
  timeout: 30000,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
});

evolutionClient.interceptors.response.use(
  (res) => res,
  (error) => {
    logger.error('Evolution API erro:', {
      status: error.response?.status,
      data:   error.response?.data,
      url:    error.config?.url,
    });
    return Promise.reject(error);
  }
);

/** Formata número para somente dígitos */
const formatPhone = (phone) => phone.replace(/\D/g, '');

/**
 * Envia mensagem de texto simples.
 */
const sendTextMessage = async (to, text) => {
  const phone = formatPhone(to);
  const response = await evolutionClient.post(`/message/sendText/${INSTANCE_NAME}`, {
    number: `${phone}@s.whatsapp.net`,
    text,
  });
  const messageId = response.data?.key?.id;
  logger.info(`Evolution API: mensagem enviada para ${phone} — id: ${messageId}`);
  return { wamid: messageId, messageId, raw: response.data };
};

// Alias usado pelo scheduler
const sendText = sendTextMessage;

/**
 * Envia mensagem com imagem.
 */
const sendImageMessage = async (to, imageUrl, caption = '') => {
  const phone = formatPhone(to);
  const response = await evolutionClient.post(`/message/sendMedia/${INSTANCE_NAME}`, {
    number: `${phone}@s.whatsapp.net`,
    mediatype: 'image',
    mimetype: 'image/jpeg',
    caption,
    media: imageUrl,
    fileName: 'imagem.jpg',
  });
  return { wamid: response.data?.key?.id, raw: response.data };
};

/**
 * Envia mensagem com botões (até 3).
 */
const sendButtonMessage = async (to, title, body, footer, buttons) => {
  const phone = formatPhone(to);
  const response = await evolutionClient.post(`/message/sendButtons/${INSTANCE_NAME}`, {
    number: `${phone}@s.whatsapp.net`,
    title,
    description: body,
    footer,
    buttons: buttons.map((b, i) => ({
      buttonId: b.buttonId || `btn_${i}`,
      buttonText: { displayText: b.buttonText },
      type: 1,
    })),
  });
  return { wamid: response.data?.key?.id, raw: response.data };
};

/**
 * Envia mensagem com lista/menu.
 */
const sendListMessage = async (to, title, body, footer, btnText, sections) => {
  const phone = formatPhone(to);
  const response = await evolutionClient.post(`/message/sendList/${INSTANCE_NAME}`, {
    number: `${phone}@s.whatsapp.net`,
    title,
    description: body,
    footer,
    buttonText: btnText,
    sections,
  });
  return { wamid: response.data?.key?.id, raw: response.data };
};

/** Obtém QR Code para conectar o WhatsApp */
const getQRCode = async () => {
  const response = await evolutionClient.get(`/instance/connect/${INSTANCE_NAME}`);
  return response.data;
};

/** Verifica status de conexão */
const getConnectionStatus = async () => {
  const response = await evolutionClient.get(`/instance/connectionState/${INSTANCE_NAME}`);
  return response.data;
};

/** Cria instância na Evolution API */
const createInstance = async () => {
  const response = await evolutionClient.post('/instance/create', {
    instanceName: INSTANCE_NAME,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  return response.data;
};

/** Configura webhook da instância */
const setWebhook = async (webhookUrl) => {
  const response = await evolutionClient.post(`/webhook/set/${INSTANCE_NAME}`, {
    url: webhookUrl,
    webhook_by_events: false,
    webhook_base64: false,
    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
  });
  return response.data;
};

/** Compatibilidade: sendTemplateMessage → sendTextMessage */
const sendTemplateMessage = async (to, templateName, language, components) => {
  const bodyComponent = components?.find((c) => c.type === 'body');
  const params = bodyComponent?.parameters?.map((p) => p.text) || [];
  let text = `[${templateName}]`;
  if (params.length) text += `\n${params.join(' ')}`;
  return sendTextMessage(to, text);
};

module.exports = {
  sendTextMessage,
  sendText,
  sendImageMessage,
  sendButtonMessage,
  sendListMessage,
  sendTemplateMessage,
  getQRCode,
  getConnectionStatus,
  createInstance,
  setWebhook,
  formatPhone,
};
