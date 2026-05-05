// src/controllers/instanceController.js
// Gerencia instância WhatsApp via Evolution API

const { createInstance, getQRCode, getConnectionStatus, setWebhook } = require('../services/evolutionApi');
const logger = require('../utils/logger');

const getStatus = async (req, res) => {
  try {
    const status = await getConnectionStatus();
    res.json({
      connected: status?.instance?.state === 'open',
      state: status?.instance?.state,
      instance: process.env.EVOLUTION_INSTANCE,
    });
  } catch (error) {
    res.status(500).json({ connected: false, error: 'Não foi possível verificar o status.' });
  }
};

const getQR = async (req, res) => {
  try {
    const data = await getQRCode();
    const qrBase64 = data?.qrcode?.base64 || data?.base64;
    const qrCode   = data?.qrcode?.code   || data?.code;

    if (!qrBase64 && !qrCode) {
      const status = await getConnectionStatus();
      if (status?.instance?.state === 'open') {
        return res.json({ connected: true, message: 'WhatsApp já está conectado!' });
      }
      return res.status(404).json({ error: 'QR Code não disponível. Tente novamente em instantes.' });
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>QR Code WhatsApp</title>
  <meta http-equiv="refresh" content="30">
  <style>
    body { font-family: Arial, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           background: #f0f2f5; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,.1); text-align: center; max-width: 400px; }
    h1 { color: #128C7E; margin-bottom: 8px; }
    p  { color: #666; margin-bottom: 24px; }
    img { width: 280px; height: 280px; }
    .hint { font-size: 13px; color: #999; margin-top: 16px; }
    .refresh { color: #128C7E; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 Conectar WhatsApp</h1>
    <p>Abra o WhatsApp → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong></p>
    ${qrBase64 ? `<img src="${qrBase64}" alt="QR Code">` : `<p><code>${qrCode}</code></p>`}
    <p class="hint">Atualiza automaticamente a cada <span class="refresh">30 segundos</span>.</p>
    <p class="hint">Instância: <strong>${process.env.EVOLUTION_INSTANCE}</strong></p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Erro ao buscar QR Code:', error);
    res.status(500).json({ error: 'Erro ao buscar QR Code. Evolution API está rodando?' });
  }
};

const setupInstance = async (req, res) => {
  try {
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const webhookUrl = `${appUrl}/api/v1/webhook/evolution`;

    try { await createInstance(); } catch (e) { /* já existe */ }

    await setWebhook(webhookUrl);

    res.json({
      success: true,
      message: 'Setup concluído! Acesse /api/v1/whatsapp/qrcode para conectar.',
      webhook: webhookUrl,
      instance: process.env.EVOLUTION_INSTANCE,
    });
  } catch (error) {
    logger.error('Erro no setup:', error);
    res.status(500).json({ error: 'Erro no setup.', details: error.message });
  }
};

module.exports = { getStatus, getQR, setupInstance };
