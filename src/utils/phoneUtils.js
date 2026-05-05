// src/utils/phoneUtils.js
// Utilitários para normalização e validação de números de telefone

/**
 * Normaliza um número para o formato E.164 com +55 (Brasil).
 * Aceita vários formatos de entrada comuns no Brasil.
 *
 * Exemplos:
 *   "(11) 99999-0000"   → "+5511999990000"
 *   "11 9 9999-0000"    → "+5511999990000"
 *   "5511999990000"     → "+5511999990000"
 *   "+5511999990000"    → "+5511999990000"
 *   "11999990000"       → "+5511999990000"
 *
 * Para outros países, passe o countryCode correto.
 */
const normalizePhone = (raw, countryCode = '55') => {
  if (!raw) return null;

  // Remove tudo que não é dígito
  let digits = String(raw).replace(/\D/g, '');

  // Se já tem código do país, não adiciona
  if (digits.startsWith(countryCode)) {
    return `+${digits}`;
  }

  // Adiciona código do país
  return `+${countryCode}${digits}`;
};

/**
 * Valida se um número está no formato E.164 válido.
 * Aceita formatos com e sem o + prefixo.
 */
const isValidE164 = (phone) => {
  if (!phone) return false;
  return /^\+?[1-9]\d{7,14}$/.test(phone);
};

/**
 * Remove o + para envio à Meta (que aceita apenas dígitos).
 */
const toMetaFormat = (phone) => {
  return String(phone).replace(/\D/g, '');
};

/**
 * Formata para exibição: +55 (11) 99999-0000
 */
const formatDisplay = (phone) => {
  const digits = toMetaFormat(phone);

  // Brasil (+55 + DDD 2 dígitos + número 8-9 dígitos)
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9) {
      return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    if (num.length === 8) {
      return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    }
  }

  return `+${digits}`;
};

module.exports = { normalizePhone, isValidE164, toMetaFormat, formatDisplay };
