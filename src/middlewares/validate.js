// src/middlewares/validate.js
// Validações reutilizáveis para entrada de dados

const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');

/**
 * Middleware que verifica erros de validação e retorna 400 se houver.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/**
 * Valida formato de telefone E.164.
 * Aceita: +5511999990000 ou 5511999990000 (sem +)
 */
const phoneRule = (field = 'phone') =>
  body(field)
    .notEmpty().withMessage('Telefone obrigatório')
    .matches(/^\+?[1-9]\d{7,14}$/).withMessage('Formato inválido. Use E.164: +5511999990000');

/**
 * Valida UUID v4.
 */
const uuidRule = (field) =>
  param(field).isUUID(4).withMessage(`${field} deve ser um UUID válido`);

/**
 * Regras para criação de contato.
 */
const contactCreateRules = [
  phoneRule(),
  body('opted_in')
    .equals('true').withMessage('opted_in deve ser true — consentimento explícito obrigatório'),
  body('opted_in_source')
    .notEmpty().withMessage('Informe a origem do consentimento (ex: website_form, checkout, manual)'),
  body('opted_in_confirmation')
    .notEmpty().withMessage('Informe o texto exibido ao usuário no momento do opt-in'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('tags').optional().isArray().withMessage('tags deve ser um array de strings'),
];

/**
 * Regras para envio de mensagem individual.
 */
const sendMessageRules = [
  phoneRule(),
  body('template_name')
    .notEmpty().withMessage('template_name é obrigatório')
    .matches(/^[a-z0-9_]+$/).withMessage('template_name deve conter apenas letras minúsculas, números e _'),
  body('language').optional().isLength({ min: 2, max: 10 }),
  body('variables').optional().isObject(),
  body('send_immediately').optional().isBoolean(),
];

/**
 * Regras para criação de campanha.
 */
const campaignCreateRules = [
  body('name').notEmpty().withMessage('Nome da campanha obrigatório'),
  body('template_id').isUUID(4).withMessage('template_id deve ser um UUID válido'),
  body('target_tags').optional().isArray(),
  body('scheduled_at').optional().isISO8601().withMessage('scheduled_at deve ser uma data ISO 8601'),
];

module.exports = {
  handleValidation,
  phoneRule,
  uuidRule,
  contactCreateRules,
  sendMessageRules,
  campaignCreateRules,
};
