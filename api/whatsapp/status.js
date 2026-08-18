/**
 * Mathura QuickMart — Serverless Endpoint: WhatsApp Cloud API Status & Health Check
 * Path: /api/whatsapp/status
 */

import { checkWhatsAppConnection } from '../utils/whatsappService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const health = await checkWhatsAppConnection();
    const hasVerifyToken = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);
    const hasAppSecret = Boolean(process.env.META_APP_SECRET);

    return res.status(200).json({
      ...health,
      webhookConfigured: hasVerifyToken,
      appSecretConfigured: hasAppSecret,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      connected: false,
      error: err.message,
      status: 'error'
    });
  }
}
