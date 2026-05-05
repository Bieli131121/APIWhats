// src/utils/metaErrorCodes.js
// Referência de códigos de erro da Meta WhatsApp Cloud API
// Fonte: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

const META_ERROR_CODES = {
  // ---- Erros de autenticação ----
  '0':     { type: 'AUTH', retry: false, desc: 'Token de acesso inválido ou expirado' },
  '190':   { type: 'AUTH', retry: false, desc: 'Token de acesso expirado ou revogado' },
  '200':   { type: 'AUTH', retry: false, desc: 'Permissão insuficiente' },

  // ---- Erros de rate limit ----
  '4':     { type: 'RATE_LIMIT', retry: true,  desc: 'Muitas chamadas à API' },
  '130429':{ type: 'RATE_LIMIT', retry: true,  desc: 'Limite de mensagens atingido — aguarde' },
  '131048':{ type: 'RATE_LIMIT', retry: true,  desc: 'Limite de spam atingido para o número' },
  '131056':{ type: 'RATE_LIMIT', retry: false, desc: 'Par (conta, número) atingiu limite diário de marketing' },

  // ---- Erros de número de destino ----
  '131026':{ type: 'INVALID_RECIPIENT', retry: false, desc: 'Número não é um usuário WhatsApp válido' },
  '131047':{ type: 'INVALID_RECIPIENT', retry: false, desc: 'Número está bloqueado/inativo' },
  '131030':{ type: 'INVALID_RECIPIENT', retry: false, desc: 'Número de telefone inválido' },

  // ---- Erros de template ----
  '132000':{ type: 'TEMPLATE',  retry: false, desc: 'Template não encontrado ou não aprovado' },
  '132001':{ type: 'TEMPLATE',  retry: false, desc: 'Variáveis do template inválidas' },
  '132005':{ type: 'TEMPLATE',  retry: false, desc: 'Idioma do template inválido' },
  '132007':{ type: 'TEMPLATE',  retry: false, desc: 'Conteúdo do template viola política' },
  '132012':{ type: 'TEMPLATE',  retry: false, desc: 'Parâmetros do template inválidos' },
  '132015':{ type: 'TEMPLATE',  retry: false, desc: 'Template pausado por baixa qualidade' },
  '132016':{ type: 'TEMPLATE',  retry: true,  desc: 'Template em processo de pausa — tente em breve' },

  // ---- Erros de janela de conversação ----
  '131009':{ type: 'WINDOW',    retry: false, desc: 'Fora da janela de 24h para mensagens livres' },

  // ---- Erros internos Meta ----
  '1':     { type: 'META_INTERNAL', retry: true, desc: 'Erro desconhecido da Meta — tente novamente' },
  '2':     { type: 'META_INTERNAL', retry: true, desc: 'Serviço temporariamente indisponível' },
  '100':   { type: 'INVALID_PARAM', retry: false, desc: 'Parâmetro inválido na requisição' },
};

/**
 * Retorna informações sobre um código de erro da Meta.
 * @param {string|number} code
 */
const getErrorInfo = (code) => {
  const key = String(code);
  return META_ERROR_CODES[key] || {
    type: 'UNKNOWN',
    retry: false,
    desc: `Código de erro desconhecido: ${code}`,
  };
};

/**
 * Indica se um erro da Meta é recuperável (deve tentar retry).
 */
const isRetryable = (code) => getErrorInfo(code).retry;

/**
 * Gera uma mensagem amigável para o log/operador.
 */
const humanizeError = (code, rawMessage) => {
  const info = getErrorInfo(code);
  return `[${info.type}] ${info.desc}${rawMessage ? ` — Meta: "${rawMessage}"` : ''}`;
};

module.exports = { getErrorInfo, isRetryable, humanizeError, META_ERROR_CODES };
