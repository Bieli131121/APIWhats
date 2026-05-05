// scripts/simulate-webhook.js
// Simula eventos de webhook da Meta para testar localmente
// sem precisar de mensagens reais.
//
// Uso: node scripts/simulate-webhook.js
// Requer: API rodando em localhost:3000

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000/api/v1';
const APP_SECRET = process.env.META_APP_SECRET || 'test_secret';

/**
 * Gera assinatura HMAC para simular payload real da Meta.
 */
const sign = (payload) => {
  const sig = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');
  return `sha256=${sig}`;
};

/**
 * Envia um payload de webhook simulado.
 */
const sendWebhook = async (payload) => {
  const body = JSON.stringify(payload);
  const signature = sign(body);

  try {
    const resp = await axios.post(`${BASE_URL}/webhook/meta`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
    });
    console.log(`✓ Webhook enviado — status: ${resp.status}`);
  } catch (e) {
    console.error(`✗ Erro: ${e.response?.status} — ${JSON.stringify(e.response?.data)}`);
  }
};

// ---- Payloads de exemplo ----

// 1. Status: mensagem entregue
const deliveredPayload = (wamid, phone) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_ID',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '5511999990000', phone_number_id: 'PHONE_ID' },
        statuses: [{
          id: wamid,
          status: 'delivered',
          timestamp: String(Math.floor(Date.now() / 1000)),
          recipient_id: phone.replace(/\D/g, ''),
        }],
      },
    }],
  }],
});

// 2. Status: mensagem lida
const readPayload = (wamid, phone) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_ID',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        statuses: [{
          id: wamid,
          status: 'read',
          timestamp: String(Math.floor(Date.now() / 1000)),
          recipient_id: phone.replace(/\D/g, ''),
        }],
      },
    }],
  }],
});

// 3. Status: mensagem falhou
const failedPayload = (wamid, phone, errorCode = '131026') => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_ID',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        statuses: [{
          id: wamid,
          status: 'failed',
          timestamp: String(Math.floor(Date.now() / 1000)),
          recipient_id: phone.replace(/\D/g, ''),
          errors: [{
            code: parseInt(errorCode),
            title: 'Receiver incapable',
            message: 'Message failed to send because there were one or more errors',
          }],
        }],
      },
    }],
  }],
});

// 4. Mensagem recebida do usuário (ex: "SAIR" para opt-out)
const incomingMessagePayload = (fromPhone, text) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_ID',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '5511999990000', phone_number_id: 'PHONE_ID' },
        contacts: [{ profile: { name: 'Usuário Teste' }, wa_id: fromPhone.replace(/\D/g, '') }],
        messages: [{
          from: fromPhone.replace(/\D/g, ''),
          id: `wamid.incoming_${Date.now()}`,
          timestamp: String(Math.floor(Date.now() / 1000)),
          type: 'text',
          text: { body: text },
        }],
      },
    }],
  }],
});

// ---- Execução ----
const run = async () => {
  const wamid = `wamid.test_${Date.now()}`;
  const testPhone = '+5511999990001';

  console.log('\n=== Simulador de Webhooks Meta ===\n');

  console.log('1. Simulando: mensagem entregue...');
  await sendWebhook(deliveredPayload(wamid, testPhone));
  await new Promise(r => setTimeout(r, 500));

  console.log('2. Simulando: mensagem lida...');
  await sendWebhook(readPayload(wamid, testPhone));
  await new Promise(r => setTimeout(r, 500));

  console.log('3. Simulando: mensagem falhou (número inválido)...');
  await sendWebhook(failedPayload(`wamid.fail_${Date.now()}`, testPhone, '131026'));
  await new Promise(r => setTimeout(r, 500));

  console.log('4. Simulando: usuário responde "SAIR" (opt-out automático)...');
  await sendWebhook(incomingMessagePayload(testPhone, 'SAIR'));

  console.log('\n=== Simulação concluída ===');
  console.log('Verifique os logs da API e o banco de dados para confirmar os resultados.');
};

run().catch(console.error);
