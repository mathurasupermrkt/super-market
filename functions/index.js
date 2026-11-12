/**
 * Mathura QuickMart — Firebase Cloud Functions
 * Secure Backend Order Assignment, Price Verification & Telemetry Synchronization
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-mathura-quickmart';
if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}
export const db = getFirestore();

export const MASTER_ADMIN_UID = '7SBL73wlj7OxKBsMExoJNhdrDTU2';
export const TRUSTED_ADMIN_EMAILS = new Set(['mathurasupermrkt@gmail.com']);

/**
 * Helper to check if a user is an authorized admin.
 * Requires explicit Master UID, strictly verified allowlisted email, or stored role == 'admin'.
 * Broad prefix matching (e.g. startsWith('admin@')) is strictly prohibited.
 */
export async function verifyAdminCaller(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  // 1. Explicit Master Admin UID
  if (auth.uid === MASTER_ADMIN_UID) return true;

  // 2. Strict allowlisted email with verified email claim
  if (
    auth.token &&
    auth.token.email &&
    auth.token.email_verified === true &&
    TRUSTED_ADMIN_EMAILS.has(auth.token.email.toLowerCase())
  ) {
    return true;
  }

  // 3. Stored database profile role (cannot be self-granted by client rules)
  const userDoc = await db.collection('users').doc(auth.uid).get();
  if (userDoc.exists && userDoc.data().role === 'admin') {
    return true;
  }

  throw new HttpsError('permission-denied', 'Only authorized administrators may perform this action.');
}

/**
 * Helper to parse timestamps from multiple data formats without silent fallback.
 * Returns millisecond epoch number or null if invalid.
 */
export function parseTimestampMs(ts) {
  if (ts === null || ts === undefined || ts === '') return null;
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) return ts;
  if (typeof ts.toMillis === 'function') {
    const val = ts.toMillis();
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    const val = d instanceof Date ? d.getTime() : null;
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  if (typeof ts === 'object' && Number.isFinite(ts._seconds)) {
    const val = ts._seconds * 1000 + (ts._nanoseconds || 0) / 1e6;
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  if (typeof ts === 'string') {
    const val = new Date(ts).getTime();
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

/**
 * 1. SECURE ORDER ASSIGNMENT HANDLER
 * Atomically assigns or reassigns an order to an approved delivery partner.
 * Prevents accidental double assignment and cleans up previous rider state upon reassignment.
 */
export async function assignOrderHandler(data, auth) {
  await verifyAdminCaller(auth);

  const { orderId, driverId, allowReassign } = data || {};
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid orderId is required.');
  }

  return await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await transaction.get(orderRef);

    if (!orderDoc.exists) {
      throw new HttpsError('not-found', `Order ${orderId} does not exist.`);
    }

    const orderData = orderDoc.data();

    // Prevent assigning completed or cancelled orders
    if (['delivered', 'cancelled'].includes(orderData.status)) {
      throw new HttpsError('failed-precondition', `Cannot assign order in '${orderData.status}' status.`);
    }

    let assignedDriverId = driverId;
    let driverData = null;

    if (assignedDriverId) {
      // Validate requested driver
      const driverRef = db.collection('users').doc(assignedDriverId);
      const driverDoc = await transaction.get(driverRef);

      if (!driverDoc.exists) {
        throw new HttpsError('not-found', `Delivery partner ${assignedDriverId} not found.`);
      }

      driverData = driverDoc.data();
      if (driverData.role !== 'delivery') {
        throw new HttpsError('failed-precondition', `User ${assignedDriverId} is not a delivery partner.`);
      }

      if (driverData.approvalStatus !== 'approved') {
        throw new HttpsError('permission-denied', `Delivery partner ${assignedDriverId} is pending admin approval.`);
      }
    } else {
      // Auto-assign: pick the first available approved rider without active assigned orders
      const eligibleSnap = await db.collection('users')
        .where('role', '==', 'delivery')
        .where('approvalStatus', '==', 'approved')
        .limit(10)
        .get();

      if (eligibleSnap.empty) {
        throw new HttpsError('unavailable', 'No approved delivery partners currently available.');
      }

      // Query active in-progress orders to find truly busy drivers
      const activeOrdersSnap = await db.collection('orders')
        .where('status', 'in', ['assigned', 'processing', 'packed', 'out-delivery'])
        .get();

      const busyDriverIds = new Set();
      activeOrdersSnap.docs.forEach((doc) => {
        const dId = doc.data().driverId;
        if (dId) busyDriverIds.add(dId);
      });

      // Find an available (idle) driver, fallback to first eligible
      let selectedDoc = eligibleSnap.docs.find(doc => !busyDriverIds.has(doc.id)) || eligibleSnap.docs[0];

      assignedDriverId = selectedDoc.id;
      driverData = selectedDoc.data();
    }

    const nowISO = new Date().toISOString();

    // Handle reassignment safely: clean up previous driver if reassigning
    if (orderData.driverId && orderData.driverId !== assignedDriverId) {
      if (!allowReassign) {
        throw new HttpsError(
          'already-exists',
          `Order is already assigned to driver ${orderData.driverName || orderData.driverId}. Pass allowReassign: true to override.`
        );
      }
      const previousDriverRef = db.collection('users').doc(orderData.driverId);
      transaction.update(previousDriverRef, {
        assignedOrders: FieldValue.arrayRemove(orderId),
        updatedAt: nowISO
      });
    }

    const driverName = driverData.name || driverData.displayName || (driverData.email ? driverData.email.split('@')[0] : 'Rider');
    const driverPhone = driverData.mobile || driverData.phone || '';

    // Update order with authoritative assignment
    transaction.update(orderRef, {
      driverId: assignedDriverId,
      driverName: driverName,
      driverPhone: driverPhone,
      driverEmail: driverData.email || '',
      status: 'assigned',
      deliveryRequestStatus: 'accepted',
      assignmentType: driverId ? 'manual_admin' : 'auto_backend',
      assignedAt: nowISO,
      updatedAt: nowISO
    });

    // Update driver document's assignedOrders array
    const driverUserRef = db.collection('users').doc(assignedDriverId);
    transaction.update(driverUserRef, {
      assignedOrders: FieldValue.arrayUnion(orderId),
      updatedAt: nowISO
    });

    return {
      success: true,
      orderId,
      driverId: assignedDriverId,
      driverName,
      status: 'assigned'
    };
  });
}

/**
 * 2. SECURE ORDER VERIFICATION & STOCK DECREMENT HANDLER
 * Recalculates prices, validates coupons/minimum order, atomically checks and decrements inventory.
 * Supports transaction-level idempotency via clientOrderId to prevent duplicate order submissions.
 */
export async function verifyAndPlaceOrderHandler(data, auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to place an order.');
  }

  const {
    items,
    address,
    customerLocation,
    paymentMethod,
    couponCode,
    customerName,
    customerPhone,
    clientOrderId
  } = data || {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart items cannot be empty.');
  }

  // Validate clientOrderId format if provided
  if (clientOrderId && (typeof clientOrderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(clientOrderId))) {
    throw new HttpsError('invalid-argument', 'Invalid clientOrderId format.');
  }

  // Validate customerLocation coordinates if provided
  if (customerLocation) {
    const lat = Number(customerLocation.latitude ?? customerLocation.lat);
    const lng = Number(customerLocation.longitude ?? customerLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new HttpsError('invalid-argument', 'Invalid customer location coordinates.');
    }
  }

  // Run atomic price verification, stock decrement, and idempotency in ONE transaction
  return await db.runTransaction(async (transaction) => {
    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();
    const orderId = clientOrderId || ('SM' + nowMs + '_' + Math.random().toString(36).substring(2, 7));
    const orderRef = db.collection('orders').doc(orderId);

    // 1. Idempotency Check ATOMICALLY inside transaction
    if (clientOrderId) {
      const existingDoc = await transaction.get(orderRef);
      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        if (existingData.userId === auth.uid) {
          return {
            success: true,
            order: existingData,
            orderId: clientOrderId,
            total: existingData.total,
            subtotal: existingData.subtotal,
            isDuplicate: true
          };
        }
        throw new HttpsError('already-exists', 'Order ID already exists for another account.');
      }
    }

    // 2. Check store status inside transaction
    const storeDoc = await transaction.get(db.collection('settings').doc('store'));
    if (storeDoc.exists && storeDoc.data().isOpen === false) {
      throw new HttpsError('failed-precondition', storeDoc.data().message || 'Store is currently closed.');
    }

    // 3. Check order rules inside transaction
    const orderRulesDoc = await transaction.get(db.collection('settings').doc('orderRules'));
    const orderRules = orderRulesDoc.exists ? orderRulesDoc.data() : {};

    // 4. Verify each item against authoritative product record
    let verifiedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      if (!item || !item.id) {
        throw new HttpsError('invalid-argument', 'Each item must have a valid product ID.');
      }
      const prodRef = db.collection('products').doc(String(item.id));
      const prodDoc = await transaction.get(prodRef);

      if (!prodDoc.exists) {
        throw new HttpsError('not-found', `Product ID ${item.id} (${item.name || 'Unknown'}) no longer exists.`);
      }

      const prodData = prodDoc.data();
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      const requestedQty = Math.max(1, parseInt(item.qty, 10) || 1);

      if (currentStock < requestedQty) {
        throw new HttpsError(
          'resource-exhausted',
          `Insufficient stock for ${prodData.name}. Available: ${currentStock}, Requested: ${requestedQty}`
        );
      }

      // Authoritative server-side price (never trust client-supplied price)
      const authoritativePrice = Number(prodData.price) || 0;
      const lineTotal = authoritativePrice * requestedQty;
      verifiedSubtotal += lineTotal;

      verifiedItems.push({
        id: item.id,
        name: prodData.name,
        price: authoritativePrice,
        mrp: prodData.mrp || authoritativePrice,
        qty: requestedQty,
        image: prodData.image || ''
      });

      // Atomic stock decrement
      transaction.update(prodRef, {
        stock: currentStock - requestedQty,
        updatedAt: nowISO
      });
    }

    // 5. Minimum order amount check
    if (orderRules.minimumOrderEnabled && verifiedSubtotal < (Number(orderRules.minimumOrderAmount) || 0)) {
      throw new HttpsError('failed-precondition', `Minimum order amount of ₹${orderRules.minimumOrderAmount} is required.`);
    }

    // 6. Coupon discount verification
    let discount = 0;
    let validatedCouponCode = null;
    if (couponCode) {
      const couponRef = db.collection('coupons').doc(String(couponCode).toUpperCase());
      const couponDoc = await transaction.get(couponRef);
      if (couponDoc.exists) {
        const c = couponDoc.data();
        if (!c.minOrder || verifiedSubtotal >= c.minOrder) {
          discount = Math.min(verifiedSubtotal, Number(c.discount) || 0);
          validatedCouponCode = couponCode.toUpperCase();
        }
      }
    }

    const deliveryFee = verifiedSubtotal >= 500 ? 0 : 30;
    const total = Math.max(0, verifiedSubtotal + deliveryFee - discount);

    const orderRecord = {
      id: orderId,
      userId: auth.uid,
      customerName: customerName || (auth.token && auth.token.name) || 'Valued Customer',
      customerPhone: customerPhone || '',
      customerEmail: (auth.token && auth.token.email) || '',
      address: address || '',
      items: verifiedItems,
      subtotal: verifiedSubtotal,
      deliveryFee,
      discount,
      couponCode: validatedCouponCode,
      total,
      paymentMethod: (paymentMethod || 'COD').toUpperCase(),
      paymentStatus: 'pending',
      status: 'confirmed',
      driverId: null,
      driverName: null,
      driverPhone: null,
      deliveryRequestStatus: 'pending',
      assignmentType: 'pending_dispatch',
      customerLocation: customerLocation || null,
      driverLocation: null,
      date: nowISO,
      createdAt: nowISO,
      updatedAt: nowISO,
      estimatedDelivery: new Date(nowMs + 2 * 24 * 60 * 60 * 1000).toISOString()
    };

    transaction.set(orderRef, orderRecord);

    return {
      success: true,
      order: orderRecord,
      orderId,
      total,
      subtotal: verifiedSubtotal
    };
  });
}

/**
 * 3. REAL-TIME DRIVER TELEMETRY SYNCHRONIZATION HANDLER
 * Copies rider GPS updates only to active assigned orders.
 * Validates coordinates, discards stale/out-of-order timestamps, and executes transactional updates.
 */
export async function syncRiderLocationToOrdersHandler(partnerId, beforeData, afterData) {
  if (!afterData) return null;

  // 1. Validate coordinate boundaries and finite numbers
  const lat = Number(afterData.latitude ?? afterData.lat);
  const lng = Number(afterData.longitude ?? afterData.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn(`[Location Sync] Discarding invalid coordinates from rider ${partnerId}: lat=${lat}, lng=${lng}`);
    return null;
  }

  // 2. Validate timestamp - strictly reject missing or unparseable timestamps
  const incomingTimeMs = parseTimestampMs(afterData.timestamp);
  if (incomingTimeMs === null) {
    console.warn(`[Location Sync] Discarding GPS update with missing or invalid timestamp from rider ${partnerId}`);
    return null;
  }

  // 3. Avoid unnecessary writes if coordinates haven't changed
  if (
    beforeData &&
    beforeData.latitude === afterData.latitude &&
    beforeData.longitude === afterData.longitude &&
    beforeData.isTracking === afterData.isTracking
  ) {
    return null;
  }

  // 4. Ensure partner is an approved delivery rider
  const userDoc = await db.collection('users').doc(partnerId).get();
  if (!userDoc.exists || userDoc.data().role !== 'delivery' || userDoc.data().approvalStatus !== 'approved') {
    return null;
  }

  // 5. Query only active orders assigned to this rider
  const activeOrdersSnap = await db.collection('orders')
    .where('driverId', '==', partnerId)
    .where('status', 'in', ['assigned', 'processing', 'packed', 'out-delivery'])
    .get();

  if (activeOrdersSnap.empty) {
    return null;
  }

  const telemetryISO = typeof afterData.timestamp === 'string'
    ? afterData.timestamp
    : new Date(incomingTimeMs).toISOString();

  const telemetry = {
    latitude: lat,
    longitude: lng,
    timestamp: telemetryISO,
    isTracking: afterData.isTracking !== false,
    updatedAt: new Date().toISOString()
  };

  let writeCount = 0;

  // Transactionally update each active order to guarantee concurrency safety against stale/out-of-order writes
  for (const orderDoc of activeOrdersSnap.docs) {
    const orderRef = orderDoc.ref;
    try {
      await db.runTransaction(async (transaction) => {
        const currentOrderSnap = await transaction.get(orderRef);
        if (!currentOrderSnap.exists) return;

        const currentTelemetry = currentOrderSnap.data().driverLocation;
        if (currentTelemetry && currentTelemetry.timestamp) {
          const currentTimestampMs = parseTimestampMs(currentTelemetry.timestamp);
          if (currentTimestampMs !== null && currentTimestampMs >= incomingTimeMs) {
            // Newer or equal coordinate packet has already been synchronized; drop stale packet
            return;
          }
        }

        transaction.update(orderRef, {
          driverLocation: telemetry,
          updatedAt: new Date().toISOString()
        });
        writeCount++;
      });
    } catch (txErr) {
      console.warn(`[Location Sync] Transaction failed for order ${orderDoc.id}:`, txErr.message);
    }
  }

  if (writeCount > 0) {
    console.log(`[Location Sync] Synchronized GPS for rider ${partnerId} to ${writeCount} active order(s).`);
  }
  return writeCount;
}

// Cloud Function v2 Callable and Trigger Exports
export const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://mathura-supermrkt.vercel.app',
  'https://mathura-quickmart-v2.web.app',
  'https://mathura-quickmart-v2.firebaseapp.com'
];

export const assignOrder = onCall({
  region: 'us-central1',
  cors: ALLOWED_ORIGINS
}, async (request) => {
  return await assignOrderHandler(request.data, request.auth);
});

export const verifyAndPlaceOrder = onCall({
  region: 'us-central1',
  cors: ALLOWED_ORIGINS
}, async (request) => {
  return await verifyAndPlaceOrderHandler(request.data, request.auth);
});

export const syncRiderLocationToOrders = onDocumentWritten('deliveryPartners/{partnerId}', async (event) => {
  const partnerId = event.params.partnerId;
  const afterData = event.data?.after?.data();
  const beforeData = event.data?.before?.data();
  return await syncRiderLocationToOrdersHandler(partnerId, beforeData, afterData);
});

/**
 * 4. REAL-TIME NOTIFICATIONS & EVENT TRIGGERS
 */
export async function handleOrderWrittenNotification(orderId, beforeData, afterData) {
  if (!afterData) return null; // deleted order

  const nowISO = new Date().toISOString();

  // Case A: New Order Created
  if (!beforeData) {
    const batch = db.batch();

    // 1. Admin Notification
    const adminNotifRef = db.collection('notifications').doc(`admin_order_${orderId}`);
    batch.set(adminNotifRef, {
      id: `admin_order_${orderId}`,
      recipientUid: 'admin',
      recipientRole: 'admin',
      type: 'new_order',
      title: 'NEW ORDER RECEIVED! 🛒',
      message: `Order #${orderId} from ${afterData.customerName || 'Customer'} (₹${afterData.total || 0})`,
      orderId: orderId,
      customerName: afterData.customerName || 'Customer',
      amount: afterData.total || 0,
      isRead: false,
      createdAt: nowISO,
      link: `/admin/dashboard.html?tab=orders&orderId=${orderId}`
    }, { merge: true });

    // 2. Customer Confirmation Notification
    if (afterData.userId) {
      const custNotifRef = db.collection('notifications').doc(`cust_order_${orderId}_created`);
      batch.set(custNotifRef, {
        id: `cust_order_${orderId}_created`,
        recipientUid: afterData.userId,
        recipientRole: 'customer',
        type: 'order_status',
        status: afterData.status || 'confirmed',
        title: 'Order Placed Successfully! 🎉',
        message: `Your order #${orderId} (₹${afterData.total || 0}) has been received and confirmed.`,
        orderId: orderId,
        amount: afterData.total || 0,
        isRead: false,
        createdAt: nowISO,
        link: `/customer/my-orders.html?orderId=${orderId}`
      }, { merge: true });
    }

    await batch.commit();
    console.log(`[Notification] Created initial order notifications for order ${orderId}`);
    return true;
  }

  // Case B: Order Status Changed
  if (beforeData.status !== afterData.status && afterData.userId) {
    const status = afterData.status;
    let title = `Order Status: ${status.toUpperCase()}`;
    let message = `Your order #${orderId} status updated to ${status}.`;

    switch (status) {
      case 'confirmed':
        title = 'Order Confirmed! 📦';
        message = `Your order #${orderId} has been confirmed. Store team is preparing your items.`;
        break;
      case 'processing':
        title = 'Order Processing ⏳';
        message = `Your order #${orderId} is being processed and assembled.`;
        break;
      case 'packed':
        title = 'Order Packed 🛍️';
        message = `Your items for order #${orderId} are packed and ready for dispatch.`;
        break;
      case 'out-delivery':
      case 'out-for-delivery':
        title = 'Out for Delivery! ⚡';
        message = `Your order #${orderId} is on the way! Our delivery partner will arrive shortly.`;
        break;
      case 'delivered':
        title = 'Order Delivered! ✅';
        message = `Your order #${orderId} has been successfully delivered. Enjoy your fresh groceries!`;
        break;
      case 'cancelled':
        title = 'Order Cancelled ❌';
        message = `Your order #${orderId} has been cancelled. Any deducted payment will be refunded.`;
        break;
      case 'refunded':
        title = 'Refund Processed 💳';
        message = `Refund for cancelled order #${orderId} has been completed.`;
        break;
    }

    const notifId = `cust_order_${orderId}_${status}`;
    await db.collection('notifications').doc(notifId).set({
      id: notifId,
      recipientUid: afterData.userId,
      recipientRole: 'customer',
      type: 'order_status',
      status: status,
      title: title,
      message: message,
      orderId: orderId,
      amount: afterData.total || 0,
      isRead: false,
      createdAt: nowISO,
      link: `/customer/my-orders.html?orderId=${orderId}`
    }, { merge: true });

    console.log(`[Notification] Sent order status notification for ${orderId}: ${status}`);
    return true;
  }

  return null;
}

export async function handleProductWrittenPriceAlert(productId, beforeData, afterData) {
  if (!beforeData || !afterData) return null;

  const oldPrice = Number(beforeData.price);
  const newPrice = Number(afterData.price);

  // Trigger only when price strictly decreases
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && newPrice < oldPrice) {
    const alertsSnap = await db.collection('priceAlerts')
      .where('productId', '==', String(productId))
      .where('isActive', '==', true)
      .where('targetPrice', '>=', newPrice)
      .get();

    if (alertsSnap.empty) return null;

    const nowISO = new Date().toISOString();
    const batch = db.batch();
    let alertCount = 0;

    for (const doc of alertsSnap.docs) {
      const alert = doc.data();
      // Avoid duplicate alert if already notified at this exact price
      if (alert.lastNotifiedPrice === newPrice) continue;

      const notifId = `price_alert_${doc.id}_${Math.round(newPrice)}`;
      const notifRef = db.collection('notifications').doc(notifId);

      batch.set(notifRef, {
        id: notifId,
        recipientUid: alert.customerUid,
        recipientRole: 'customer',
        type: 'price_alert',
        title: `Price Drop Alert: ${afterData.name || 'Product'} 📉`,
        message: `Price dropped from ₹${oldPrice} to ₹${newPrice}! (Your target was ₹${alert.targetPrice})`,
        productId: String(productId),
        previousPrice: oldPrice,
        currentPrice: newPrice,
        targetPrice: alert.targetPrice,
        isRead: false,
        createdAt: nowISO,
        link: `/customer/product-detail.html?id=${productId}`
      }, { merge: true });

      batch.update(doc.ref, {
        lastNotifiedPrice: newPrice,
        lastNotifiedAt: nowISO
      });

      alertCount++;
    }

    if (alertCount > 0) {
      await batch.commit();
      console.log(`[Price Alert] Sent ${alertCount} price alert notification(s) for product ${productId}`);
    }
    return alertCount;
  }

  return null;
}

export const onOrderWritten = onDocumentWritten('orders/{orderId}', async (event) => {
  const orderId = event.params.orderId;
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();
  return await handleOrderWrittenNotification(orderId, beforeData, afterData);
});

export const onProductWritten = onDocumentWritten('products/{productId}', async (event) => {
  const productId = event.params.productId;
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();
  return await handleProductWrittenPriceAlert(productId, beforeData, afterData);
});
