/**
 * Mathura QuickMart — Serverless Endpoint: Admin Live WhatsApp Test Message
 * Path: /api/whatsapp/test
 */

import { sendTemplateMessage, normalizePhoneNumber } from '../utils/whatsappService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { phone, template = 'order_confirmed', sampleParams } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required for test dispatch.' });
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      return res.status(400).json({ error: `Invalid phone number: ${phone}` });
    }

    const defaultParams = sampleParams || ['Test Customer', 'TEST-QM999', '499'];

    const result = await sendTemplateMessage({
      to: normalized,
      templateName: template,
      languageCode: 'en',
      bodyParameters: defaultParams
    });

    return res.status(200).json({
      success: result.success !== false,
      result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
