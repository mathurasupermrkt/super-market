/**
 * Mathura QuickMart — Serverless Endpoint: Automated WhatsApp Offer Campaign Broadcaster
 * Path: /api/whatsapp/send-campaign
 */

import { sendTemplateMessage, normalizePhoneNumber } from '../utils/whatsappService.js';
import { setFirestoreDoc, getFirestoreDoc } from '../utils/firebaseAdmin.js';

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
      campaignId,
      title,
      description = '',
      couponCode,
      discount,
      minOrder = '499',
      expiryDate = 'Sunday Midnight',
      bannerUrl = null,
      templateName = bannerUrl ? 'marketing_offer_image' : 'marketing_offer',
      recipients = []
    } = req.body || {};

    if (!title || !couponCode || !discount) {
      return res.status(400).json({
        error: 'Missing required campaign fields: title, couponCode, and discount are required.'
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: 'Recipients list cannot be empty.'
      });
    }

    const cId = campaignId || `camp_${Date.now()}`;
    const nowISO = new Date().toISOString();

    // ── 1. Create or Update Campaign Document in Firestore ────────────────────
    const campaignDoc = {
      campaignId: cId,
      title,
      description,
      couponCode,
      discount,
      minOrder,
      expiryDate,
      bannerUrl,
      templateName,
      targetType: req.body.targetType || 'opted_in',
      recipientCount: recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      status: 'processing',
      createdAt: nowISO,
      startedAt: nowISO,
      completedAt: null
    };

    await setFirestoreDoc('whatsappCampaigns', cId, campaignDoc, true);

    // ── 2. Controlled Batch Sending with Rate Limit Pacing ────────────────────
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 500; // 500ms delay between batches

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (customer) => {
        const phone = normalizePhoneNumber(customer.phone || customer.customerPhone);
        const name = customer.name || customer.customerName || 'Valued Customer';
        const msgId = `camp_${cId}_${customer.uid || customer.id || phone}`;

        if (!phone) {
          results.failed++;
          results.errors.push({ customer: name, error: 'Invalid phone number' });
          return;
        }

        // Variable body parameters: {{1}} customer_name, {{2}} offer_title, {{3}} discount, {{4}} coupon_code, {{5}} min_order, {{6}} expiry_date
        const bodyParameters = [
          name,
          title,
          discount,
          couponCode,
          String(minOrder),
          expiryDate
        ];

        const sendRes = await sendTemplateMessage({
          to: phone,
          templateName,
          languageCode: 'en',
          bodyParameters,
          headerImageUrl: bannerUrl || null
        });

        const isSuccess = sendRes.success !== false;
        const whatsappMessageId = sendRes.messageId || sendRes.data?.messages?.[0]?.id || null;

        if (isSuccess) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({ phone, error: sendRes.error });
        }

        // Save individual message document in Firestore
        const msgRecord = {
          messageId: msgId,
          campaignId: cId,
          customerId: customer.uid || customer.id || 'unknown',
          customerName: name,
          customerPhone: phone,
          messageType: 'PROMOTIONAL_OFFER',
          templateName,
          status: isSuccess ? 'sent' : 'failed',
          whatsappMessageId,
          createdAt: nowISO,
          sentAt: isSuccess ? nowISO : null,
          deliveredAt: null,
          readAt: null,
          failedAt: isSuccess ? null : nowISO,
          errorMessage: isSuccess ? null : (sendRes.error || 'Failed to dispatch offer')
        };

        await setFirestoreDoc('whatsappMessages', msgId, msgRecord, true);
      }));

      // Pacing delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // ── 3. Update Final Campaign Status ───────────────────────────────────────
    await setFirestoreDoc('whatsappCampaigns', cId, {
      sentCount: results.sent,
      failedCount: results.failed,
      status: results.sent > 0 ? 'completed' : 'failed',
      completedAt: new Date().toISOString()
    }, true);

    return res.status(200).json({
      success: true,
      campaignId: cId,
      summary: {
        totalRecipients: results.total,
        sent: results.sent,
        failed: results.failed
      },
      status: 'completed'
    });

  } catch (err) {
    console.error('[Send Campaign Handler Error]:', err);
    return res.status(500).json({
      error: 'Internal Server Error while broadcasting WhatsApp campaign',
      details: err.message
    });
  }
}
