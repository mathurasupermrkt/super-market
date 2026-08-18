/**
 * Mathura QuickMart — Backend Meta WhatsApp Business Cloud API Service
 * Official Meta Graph API integration with retry backoff and rate-limiting.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Normalizes phone numbers to standard WhatsApp format (digits only, e.g. 919876543210)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  
  // Convert standard 10-digit Indian numbers to 91XXXXXXXXXX
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  }

  // Validate length (E.164: 10 to 15 digits)
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  return digits;
}

/**
 * Low-level dispatcher to Meta WhatsApp Cloud API endpoint with exponential retry
 */
export async function sendMetaApiRequest(payload, retries = 2, delayMs = 1000) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ Meta WhatsApp Cloud API credentials missing (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set).');
    return {
      success: false,
      isSimulated: true,
      error: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured in Vercel environment variables.',
      messages: [{ id: 'sim_msg_' + Date.now() }]
    };
  }

  const endpoint = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.messages && data.messages.length > 0) {
        return {
          success: true,
          messageId: data.messages[0].id,
          data
        };
      }

      // Check for rate-limit / transient error
      const errorCode = data.error?.code;
      const isRateLimit = errorCode === 130429 || errorCode === 80007;
      const isTransient = response.status >= 500 || isRateLimit;

      if (isTransient && attempt <= retries) {
        console.warn(`[WhatsApp API] Transient error (Attempt ${attempt}/${retries + 1}). Retrying in ${delayMs}ms...`, data.error?.message);
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }

      console.error('[WhatsApp API Error]', JSON.stringify(data.error || data));
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message via Meta Cloud API',
        errorCode: data.error?.code,
        errorDetails: data.error
      };
    } catch (networkError) {
      console.error(`[WhatsApp API Network Error] Attempt ${attempt}:`, networkError.message);
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      return {
        success: false,
        error: networkError.message
      };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Sends an approved WhatsApp Template message
 */
export async function sendTemplateMessage({
  to,
  templateName,
  languageCode = 'en',
  bodyParameters = [],
  headerImageUrl = null,
  buttonPayload = null
}) {
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    return {
      success: false,
      error: `Invalid recipient phone number: ${to}`
    };
  }

  const components = [];

  // Header Component (Optional Image Banner)
  if (headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: headerImageUrl
          }
        }
      ]
    });
  }

  // Body Component (Variables {{1}}, {{2}}, etc.)
  if (bodyParameters && bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map(val => ({
        type: 'text',
        text: String(val ?? '')
      }))
    });
  }

  // Button Component (Optional Quick Reply / URL suffix)
  if (buttonPayload) {
    components.push({
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [
        {
          type: 'payload',
          payload: buttonPayload
        }
      ]
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components.length > 0 ? components : undefined
    }
  };

  return await sendMetaApiRequest(payload);
}

/**
 * Sends a plain 24h session text message (customer service response)
 */
export async function sendTextMessage({ to, text }) {
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'text',
    text: {
      body: text,
      preview_url: false
    }
  };

  return await sendMetaApiRequest(payload);
}

/**
 * Sends an order notification using predefined official templates
 */
export async function sendOrderNotification({
  eventType,
  orderId,
  customerName,
  customerPhone,
  total,
  driverName,
  eta,
  customTemplateName
}) {
  const normalizedPhone = normalizePhoneNumber(customerPhone);
  if (!normalizedPhone) {
    return { success: false, error: 'Customer phone number is missing or invalid' };
  }

  let templateName = customTemplateName;
  let bodyParameters = [];

  const safeName = customerName || 'Valued Customer';
  const safeId = String(orderId || '');
  const safeTotal = String(total || '0');

  switch (eventType) {
    case 'ORDER_CONFIRMED':
    case 'confirmed':
      templateName = templateName || 'order_confirmed';
      bodyParameters = [safeName, safeId, safeTotal];
      break;

    case 'PROCESSING':
    case 'processing':
      templateName = templateName || 'order_processing';
      bodyParameters = [safeName, safeId];
      break;

    case 'OUT_FOR_DELIVERY':
    case 'out-delivery':
    case 'out_for_delivery':
      templateName = templateName || 'order_out_for_delivery';
      bodyParameters = [safeName, safeId, driverName || 'Our delivery partner', eta || '20-30 mins'];
      break;

    case 'DELIVERED':
    case 'delivered':
      templateName = templateName || 'order_delivered';
      bodyParameters = [safeName, safeId];
      break;

    case 'CANCELLED':
    case 'cancelled':
      templateName = templateName || 'order_cancelled';
      bodyParameters = [safeName, safeId];
      break;

    default:
      templateName = templateName || 'order_confirmed';
      bodyParameters = [safeName, safeId, safeTotal];
      break;
  }

  return await sendTemplateMessage({
    to: normalizedPhone,
    templateName,
    languageCode: 'en',
    bodyParameters
  });
}

/**
 * Checks connectivity and account metadata with Meta Graph API
 */
export async function checkWhatsAppConnection() {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return {
      connected: false,
      error: 'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID',
      status: 'unconfigured'
    };
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}?fields=verified_name,code_verification_status,display_phone_number,quality_rating`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const data = await res.json();

    if (res.ok) {
      return {
        connected: true,
        phoneNumberId: PHONE_NUMBER_ID,
        businessAccountId: BUSINESS_ACCOUNT_ID,
        displayPhoneNumber: data.display_phone_number || 'Registered',
        verifiedName: data.verified_name || 'Mathura QuickMart',
        qualityRating: data.quality_rating || 'GREEN',
        status: 'active'
      };
    }

    return {
      connected: false,
      error: data.error?.message || 'Meta API returned error',
      details: data.error,
      status: 'error'
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      status: 'network_error'
    };
  }
}
