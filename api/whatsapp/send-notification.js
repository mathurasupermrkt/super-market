/**
 * Mathura QuickMart — Serverless Endpoint: Send Order/Delivery WhatsApp Notification
 * Path: /api/whatsapp/send-notification
 */

import { sendOrderNotification, normalizePhoneNumber } from '../utils/whatsappService.js';
import { getFirestoreDoc, setFirestoreDoc } from '../utils/firebaseAdmin.js';

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const {
      orderId,
      eventType = 'ORDER_CONFIRMED',
      customerName = 'Valued Customer',
      customerPhone,
      total = 0,
      driverName,
      eta,
      customerId,
      customTemplateName
    } = req.body || {};

    if (!orderId || !customerPhone) {
      return res.status(400).json({
        error: 'Missing required parameters: orderId and customerPhone are required.'
      });
    }

    const normalizedPhone = normalizePhoneNumber(customerPhone);
    if (!normalizedPhone) {
      return res.status(400).json({
        error: `Invalid customer WhatsApp number: ${customerPhone}`
      });
    }

    // ── 1. Deduplication Protection ──────────────────────────────────────────
    // Create unique event key: {orderId}_{eventType}_v1
    const dedupeKey = `${orderId}_${eventType}_v1`;
    const existingMsg = await getFirestoreDoc('whatsappMessages', dedupeKey);

    if (existingMsg && (existingMsg.status === 'sent' || existingMsg.status === 'delivered' || existingMsg.status === 'read')) {
      console.log(`[Deduplication] Message ${dedupeKey} already sent. Skipping.`);
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Notification already sent for this event state.',
        messageId: dedupeKey
      });
    }

    // ── 2. Check Customer Preferences ─────────────────────────────────────────
    if (customerId) {
      const userDoc = await getFirestoreDoc('users', customerId);
      if (userDoc) {
        if (userDoc.whatsappOptIn === false) {
          console.log(`[Opt-out] Customer ${customerId} disabled WhatsApp alerts.`);
          return res.status(200).json({
            success: false,
            skipped: true,
            reason: 'Customer has opted out of WhatsApp notifications.'
          });
        }
        if (eventType.includes('DELIVERY') && userDoc.deliveryUpdatesEnabled === false) {
          return res.status(200).json({
            success: false,
            skipped: true,
            reason: 'Customer disabled delivery notifications.'
          });
        }
      }
    }

    // ── 3. Send Notification via Meta Cloud API ──────────────────────────────
    const apiResult = await sendOrderNotification({
      eventType,
      orderId,
      customerName,
      customerPhone: normalizedPhone,
      total,
      driverName,
      eta,
      customTemplateName
    });

    const nowISO = new Date().toISOString();
    const isSuccess = apiResult.success !== false;
    const whatsappMessageId = apiResult.messageId || (apiResult.data?.messages?.[0]?.id) || null;

    // ── 4. Log Message Record in Firestore ────────────────────────────────────
    const msgRecord = {
      messageId: dedupeKey,
      orderId,
      customerId: customerId || 'guest',
      customerName,
      customerPhone: normalizedPhone,
      rawPhone: customerPhone,
      messageType: eventType,
      templateName: customTemplateName || eventType.toLowerCase(),
      status: isSuccess ? 'sent' : 'failed',
      whatsappMessageId,
      createdAt: nowISO,
      sentAt: isSuccess ? nowISO : null,
      deliveredAt: null,
      readAt: null,
      failedAt: isSuccess ? null : nowISO,
      errorMessage: isSuccess ? null : (apiResult.error || 'Failed to dispatch via Meta API')
    };

    await setFirestoreDoc('whatsappMessages', dedupeKey, msgRecord, true);

    return res.status(200).json({
      success: isSuccess,
      messageId: dedupeKey,
      whatsappMessageId,
      status: msgRecord.status,
      error: apiResult.error
    });

  } catch (err) {
    console.error('[Send Notification Handler Error]:', err);
    return res.status(500).json({
      error: 'Internal Server Error while sending WhatsApp notification',
      details: err.message
    });
  }
}
