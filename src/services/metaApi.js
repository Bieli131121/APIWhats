// src/services/metaApi.js
// Serviço de integração com a Meta WhatsApp Cloud API oficial
// Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api

const axios = require('axios');
const logger = require('../utils/logger');

const META_API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v19.0'}`;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.META_WABA_ID;

// Cliente axios configurado com auth e timeout
const metaClient = axios.create({
  baseURL: META_API_BASE,
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Interceptor para logar chamadas à API da Meta
metaClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errData = error.response?.data?.error || {};
    logger.error('Meta API erro:', {
      status: error.response?.status,
      code: errData.code,
      type: errData.type,
      message: errData.message,
    });
    return Promise.reject(error);
  }
);

/**
 * Envia uma mensagem usando um template aprovado pela Meta.
 *
 * @param {string} to - Número no formato E.164 (ex: +5511999990000)
 * @param {string} templateName - Nome do template cadastrado na Meta
 * @param {string} language - Código do idioma (ex: pt_BR)
 * @param {Array}  components - Componentes do template (variáveis, header, etc.)
 * @returns {Object} Resposta da Meta com wamid (message ID)
 */
const sendTemplateMessage = async (to, templateName, language = 'pt_BR', components = []) => {
  // Remove + e espaços do número para o formato aceito pela Meta
  const formattedPhone = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: components,
    },
  };

  logger.info(`Meta API: enviando template "${templateName}" para ${formattedPhone}`);

  const response = await metaClient.post(`/${PHONE_NUMBER_ID}/messages`, payload);
  const wamid = response.data?.messages?.[0]?.id;

  logger.info(`Meta API: mensagem aceita - wamid: ${wamid}`);
  return { wamid, raw: response.data };
};

/**
 * Verifica o status de um número de telefone no WhatsApp.
 * Útil para validar contatos antes de enviar.
 *
 * @param {string} phone - Número E.164
 */
const checkPhoneNumber = async (phone) => {
  const formattedPhone = phone.replace(/\D/g, '');
  const response = await metaClient.get(`/${PHONE_NUMBER_ID}`, {
    params: { fields: 'display_phone_number,verified_name,quality_rating' },
  });
  return response.data;
};

/**
 * Lista todos os templates aprovados da conta WABA.
 * Use para sincronizar o banco local com a Meta.
 */
const listTemplates = async () => {
  const response = await metaClient.get(`/${WABA_ID}/message_templates`, {
    params: {
      fields: 'name,status,category,language,components',
      limit: 100,
    },
  });
  return response.data?.data || [];
};

/**
 * Cria um novo template via API (alternativa ao painel Meta).
 * O template precisa ser aprovado pela Meta antes de ser usado.
 *
 * @param {Object} templateData - Dados do template
 */
const createTemplate = async (templateData) => {
  const response = await metaClient.post(`/${WABA_ID}/message_templates`, templateData);
  return response.data;
};

/**
 * Constrói o array de components para templates com variáveis.
 *
 * Exemplo de uso:
 *   buildComponents({ body: ['João', 'Produto X', 'R$ 99'] })
 *
 * @param {Object} vars - { header: [], body: [], buttons: [] }
 */
const buildComponents = (vars = {}) => {
  const components = [];

  if (vars.header?.length) {
    components.push({
      type: 'header',
      parameters: vars.header.map((v) =>
        typeof v === 'string'
          ? { type: 'text', text: v }
          : v // permite passar objetos para imagem/video
      ),
    });
  }

  if (vars.body?.length) {
    components.push({
      type: 'body',
      parameters: vars.body.map((v) => ({ type: 'text', text: String(v) })),
    });
  }

  if (vars.buttons?.length) {
    vars.buttons.forEach((btn, index) => {
      components.push({
        type: 'button',
        sub_type: btn.sub_type || 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload: btn.payload }],
      });
    });
  }

  return components;
};

module.exports = {
  sendTemplateMessage,
  checkPhoneNumber,
  listTemplates,
  createTemplate,
  buildComponents,
};
