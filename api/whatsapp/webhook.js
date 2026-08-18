/**
 * Mathura QuickMart — Meta WhatsApp Cloud API Webhook Handler
 * Path: /api/whatsapp/webhook
 * 
 * GET: Handles Meta Webhook verification challenge
 * POST: Handles incoming delivery status events (sent, delivered, read, failed)
 */

import { findDocByField, setFirestoreDoc, getFirestoreDoc } from '../utils/firebaseAdmin.js';

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. GET: META WEBHOOK VERIFICATION HANDSHAKE
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mathura_quickmart_secret_webhook_verify_token_2026';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ [Meta Webhook Verification] Successfully verified webhook challenge token!');
      return res.status(200).send(challenge);
    } else {
      console.warn('❌ [Meta Webhook Verification] Token mismatch or invalid mode.');
      return res.status(403).json({ error: 'Verification failed. Invalid verify token.' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. POST: INCOMING WHATSAPP STATUS NOTIFICATIONS & MESSAGES
  // ══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    try {
      const body = req.body;

      if (!body || body.object !== 'whatsapp_business_account') {
        return res.status(200).send('EVENT_RECEIVED');
      }

      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const statuses = value.statuses || [];

          for (const statusObj of statuses) {
            const wamid = statusObj.id; // e.g. wamid.HBgL...
            const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000).toISOString() : new Date().toISOString();
            const recipientPhone = statusObj.recipient_id;
            const errors = statusObj.errors;

            console.log(`[Webhook Status] WAMID: ${wamid} → Status: ${status} for ${recipientPhone}`);

            // Find matching document in Firestore by whatsappMessageId
            let matchDoc = await findDocByField('whatsappMessages', 'whatsappMessageId', wamid);

            if (matchDoc) {
              const updates = {
                status: status,
                updatedAt: timestamp
              };

              if (status === 'delivered') updates.deliveredAt = timestamp;
              if (status === 'read') updates.readAt = timestamp;
              if (status === 'failed') {
                updates.failedAt = timestamp;
                if (errors && errors.length > 0) {
                  updates.errorMessage = `${errors[0].title || ''}: ${errors[0].message || 'Delivery failed'}`;
                  updates.errorCode = errors[0].code;
                }
              }

              await setFirestoreDoc('whatsappMessages', matchDoc.id, updates, true);

              // Update Campaign aggregate counters if part of campaign
              if (matchDoc.campaignId) {
                const campDoc = await getFirestoreDoc('whatsappCampaigns', matchDoc.campaignId);
                if (campDoc) {
                  const campUpdates = {};
                  if (status === 'delivered') campUpdates.deliveredCount = (campDoc.deliveredCount || 0) + 1;
                  if (status === 'read') campUpdates.readCount = (campDoc.readCount || 0) + 1;
                  if (status === 'failed') campUpdates.failedCount = (campDoc.failedCount || 0) + 1;

                  await setFirestoreDoc('whatsappCampaigns', matchDoc.campaignId, campUpdates, true);
                }
              }
            }
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('[Meta Webhook POST Error]:', err);
      return res.status(200).send('EVENT_RECEIVED'); // Always return 200 to prevent Meta webhook retrying
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
