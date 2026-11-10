/**
 * Mathura QuickMart — Cloud Functions Integration Test Suite
 * Validates:
 * 1. Administrator Authorization (Allowlist, Verified Emails, Role Checks, Prefix Rejection)
 * 2. Trusted Checkout, Price Verification, Stock Decrement & Idempotency
 * 3. Concurrency Protection (Duplicate Checkouts, Stock Consistency)
 * 4. GPS Telemetry Synchronization (Timestamp Validation, Stale Event Rejection, Concurrency)
 * 5. Rider Assignment Safety (Role Checks, Double Assignment Prevention, Workload Availability)
 */

import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';

import {
  db,
  MASTER_ADMIN_UID,
  TRUSTED_ADMIN_EMAILS,
  verifyAdminCaller,
  parseTimestampMs,
  verifyAndPlaceOrderHandler,
  assignOrderHandler,
  syncRiderLocationToOrdersHandler,
} from '../functions/index.js';

// Helper to seed or clear collections
async function clearCollection(colName) {
  const snap = await db.collection(colName).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

before(async () => {
  // Ensure emulator connectivity
  await db.collection('_test_probe').doc('init').set({ ok: true });
});

after(async () => {
  await db.collection('_test_probe').doc('init').delete();
});

beforeEach(async () => {
  await clearCollection('orders');
  await clearCollection('products');
  await clearCollection('users');
  await clearCollection('settings');
  await clearCollection('coupons');
  await clearCollection('deliveryPartners');

  // Seed baseline users
  await db.collection('users').doc('customer1').set({
    role: 'customer',
    name: 'Customer One',
    email: 'customer1@example.com'
  });

  await db.collection('users').doc('customer2').set({
    role: 'customer',
    name: 'Customer Two',
    email: 'customer2@example.com'
  });

  await db.collection('users').doc('adminUser').set({
    role: 'admin',
    name: 'DB Admin User',
    email: 'customadmin@domain.com'
  });

  await db.collection('users').doc('driver1').set({
    role: 'delivery',
    approvalStatus: 'approved',
    name: 'Rider One',
    email: 'rider1@example.com',
    assignedOrders: []
  });

  await db.collection('users').doc('driver2').set({
    role: 'delivery',
    approvalStatus: 'approved',
    name: 'Rider Two',
    email: 'rider2@example.com',
    assignedOrders: []
  });

  await db.collection('users').doc('pendingDriver').set({
    role: 'delivery',
    approvalStatus: 'pending',
    name: 'Pending Rider',
    email: 'pendingrider@example.com',
    assignedOrders: []
  });

  // Seed baseline products
  await db.collection('products').doc('p1').set({
    name: 'Organic Apples',
    price: 100,
    mrp: 120,
    stock: 10,
    category: 'Fruits'
  });

  await db.collection('products').doc('p2').set({
    name: 'Whole Milk',
    price: 50,
    mrp: 60,
    stock: 2,
    category: 'Dairy'
  });

  // Seed store settings
  await db.collection('settings').doc('store').set({
    isOpen: true
  });

  await db.collection('settings').doc('orderRules').set({
    minimumOrderAmount: 100,
    minimumOrderEnabled: true
  });
});

// ============================================================================
// 1. ADMINISTRATOR AUTHORIZATION TESTS
// ============================================================================

test('verifyAdminCaller accepts Master Admin UID', async () => {
  const result = await verifyAdminCaller({ uid: MASTER_ADMIN_UID });
  assert.equal(result, true);
});

test('verifyAdminCaller accepts allowlisted email with verified email claim', async () => {
  const result = await verifyAdminCaller({
    uid: 'randomUid123',
    token: {
      email: 'mathurasupermrkt@gmail.com',
      email_verified: true
    }
  });
  assert.equal(result, true);
});

test('verifyAdminCaller accepts user with stored database role == admin', async () => {
  const result = await verifyAdminCaller({ uid: 'adminUser' });
  assert.equal(result, true);
});

test('verifyAdminCaller rejects unauthenticated caller', async () => {
  await assert.rejects(
    async () => verifyAdminCaller(null),
    (err) => err.code === 'unauthenticated'
  );
});

test('verifyAdminCaller rejects regular customer', async () => {
  await assert.rejects(
    async () => verifyAdminCaller({ uid: 'customer1' }),
    (err) => err.code === 'permission-denied'
  );
});

test('verifyAdminCaller rejects untrusted email with admin@ prefix', async () => {
  await assert.rejects(
    async () => verifyAdminCaller({
      uid: 'fakeAdminUid',
      token: {
        email: 'admin@attacker.test',
        email_verified: true
      }
    }),
    (err) => err.code === 'permission-denied'
  );
});

test('verifyAdminCaller rejects allowlisted email if email_verified is false', async () => {
  await assert.rejects(
    async () => verifyAdminCaller({
      uid: 'unverifiedUid',
      token: {
        email: 'mathurasupermrkt@gmail.com',
        email_verified: false
      }
    }),
    (err) => err.code === 'permission-denied'
  );
});

// ============================================================================
// 2. CHECKOUT INTEGRATION & STOCK INTEGRITY TESTS
// ============================================================================

test('verifyAndPlaceOrder places valid order, decrements stock, and returns order', async () => {
  const auth = { uid: 'customer1', token: { email: 'customer1@example.com', name: 'Customer One' } };
  const data = {
    items: [{ id: 'p1', qty: 2 }],
    address: '123 Main Street',
    clientOrderId: 'SM_ORDER_001'
  };

  const res = await verifyAndPlaceOrderHandler(data, auth);
  assert.equal(res.success, true);
  assert.equal(res.orderId, 'SM_ORDER_001');
  assert.equal(res.subtotal, 200); // 2 * 100
  assert.equal(res.total, 230); // 200 + 30 delivery fee

  // Verify database record
  const orderDoc = await db.collection('orders').doc('SM_ORDER_001').get();
  assert.equal(orderDoc.exists, true);
  assert.equal(orderDoc.data().userId, 'customer1');
  assert.equal(orderDoc.data().status, 'confirmed');

  // Verify stock was decremented from 10 to 8
  const prodDoc = await db.collection('products').doc('p1').get();
  assert.equal(prodDoc.data().stock, 8);
});

test('verifyAndPlaceOrder uses authoritative price and ignores forged client prices', async () => {
  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p1', qty: 2, price: 1 }], // Client claims price is 1
    clientOrderId: 'SM_ORDER_FORGED'
  };

  const res = await verifyAndPlaceOrderHandler(data, auth);
  assert.equal(res.subtotal, 200); // Authoritative 100 * 2 = 200, not 2
  assert.equal(res.total, 230);
});

test('verifyAndPlaceOrder rejects order with insufficient stock and preserves inventory', async () => {
  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p2', qty: 5 }], // Stock is 2
    clientOrderId: 'SM_ORDER_OOS'
  };

  await assert.rejects(
    async () => verifyAndPlaceOrderHandler(data, auth),
    (err) => err.code === 'resource-exhausted'
  );

  // Stock must remain unchanged
  const prodDoc = await db.collection('products').doc('p2').get();
  assert.equal(prodDoc.data().stock, 2);

  // Order must not exist
  const orderDoc = await db.collection('orders').doc('SM_ORDER_OOS').get();
  assert.equal(orderDoc.exists, false);
});

test('verifyAndPlaceOrder rejects order when store is closed', async () => {
  await db.collection('settings').doc('store').update({ isOpen: false });

  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p1', qty: 1 }],
    clientOrderId: 'SM_ORDER_CLOSED'
  };

  await assert.rejects(
    async () => verifyAndPlaceOrderHandler(data, auth),
    (err) => err.code === 'failed-precondition'
  );
});

test('verifyAndPlaceOrder rejects order below minimum order amount', async () => {
  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p2', qty: 1 }], // Subtotal 50, minimum is 100
    clientOrderId: 'SM_ORDER_BELOW_MIN'
  };

  await assert.rejects(
    async () => verifyAndPlaceOrderHandler(data, auth),
    (err) => err.code === 'failed-precondition'
  );
});

test('verifyAndPlaceOrder idempotency returns existing order and prevents double decrement', async () => {
  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p1', qty: 2 }],
    clientOrderId: 'SM_ORDER_IDEMPOTENT'
  };

  // First request
  const firstRes = await verifyAndPlaceOrderHandler(data, auth);
  assert.equal(firstRes.success, true);
  assert.equal(firstRes.isDuplicate, undefined);

  // Verify stock decremented to 8
  let prodDoc = await db.collection('products').doc('p1').get();
  assert.equal(prodDoc.data().stock, 8);

  // Duplicate request with same clientOrderId
  const secondRes = await verifyAndPlaceOrderHandler(data, auth);
  assert.equal(secondRes.success, true);
  assert.equal(secondRes.isDuplicate, true);
  assert.equal(secondRes.orderId, 'SM_ORDER_IDEMPOTENT');

  // Stock must STILL be 8 (NOT decremented twice)
  prodDoc = await db.collection('products').doc('p1').get();
  assert.equal(prodDoc.data().stock, 8);
});

test('verifyAndPlaceOrder prevents another customer from reusing clientOrderId', async () => {
  const auth1 = { uid: 'customer1' };
  const auth2 = { uid: 'customer2' };

  await verifyAndPlaceOrderHandler(
    { items: [{ id: 'p1', qty: 1 }], clientOrderId: 'SM_ORDER_STOLEN' },
    auth1
  );

  // customer2 tries to use same clientOrderId
  await assert.rejects(
    async () => verifyAndPlaceOrderHandler(
      { items: [{ id: 'p1', qty: 1 }], clientOrderId: 'SM_ORDER_STOLEN' },
      auth2
    ),
    (err) => err.code === 'already-exists'
  );
});

test('verifyAndPlaceOrder handles concurrent identical requests atomically without double decrement', async () => {
  const auth = { uid: 'customer1' };
  const data = {
    items: [{ id: 'p1', qty: 2 }],
    clientOrderId: 'SM_CONCURRENT_IDEMPOTENT'
  };

  // Fire 2 simultaneous requests with same clientOrderId
  const [res1, res2] = await Promise.all([
    verifyAndPlaceOrderHandler(data, auth),
    verifyAndPlaceOrderHandler(data, auth)
  ]);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);

  // Exactly one of them or both returned valid order
  const orderDoc = await db.collection('orders').doc('SM_CONCURRENT_IDEMPOTENT').get();
  assert.equal(orderDoc.exists, true);

  // Stock must only be decremented once: 10 - 2 = 8
  const prodDoc = await db.collection('products').doc('p1').get();
  assert.equal(prodDoc.data().stock, 8);
});

// ============================================================================
// 3. GPS TELEMETRY & TIMESTAMP SAFETY TESTS
// ============================================================================

test('parseTimestampMs parses numbers, strings, and Firestore Timestamps correctly', () => {
  const epoch = 1730000000000;
  const iso = '2026-10-26T12:00:00.000Z';
  const fsTs = Timestamp.fromMillis(epoch);

  assert.equal(parseTimestampMs(epoch), epoch);
  assert.equal(parseTimestampMs(iso), new Date(iso).getTime());
  assert.equal(parseTimestampMs(fsTs), epoch);
  assert.equal(parseTimestampMs(null), null);
  assert.equal(parseTimestampMs(''), null);
  assert.equal(parseTimestampMs('invalid-date'), null);
  assert.equal(parseTimestampMs(-10), null);
});

test('syncRiderLocationToOrders synchronizes valid coordinates to active assigned orders', async () => {
  // Create active order assigned to driver1
  await db.collection('orders').doc('ord_active').set({
    status: 'out-delivery',
    driverId: 'driver1',
    driverLocation: null
  });

  const afterData = {
    latitude: 9.3639,
    longitude: 78.8395,
    timestamp: '2026-10-26T10:00:00.000Z',
    isTracking: true
  };

  const syncCount = await syncRiderLocationToOrdersHandler('driver1', null, afterData);
  assert.equal(syncCount, 1);

  const orderDoc = await db.collection('orders').doc('ord_active').get();
  assert.equal(orderDoc.data().driverLocation.latitude, 9.3639);
  assert.equal(orderDoc.data().driverLocation.longitude, 78.8395);
});

test('syncRiderLocationToOrders discards invalid coordinates', async () => {
  const syncCount = await syncRiderLocationToOrdersHandler('driver1', null, {
    latitude: 195, // Out of range
    longitude: 78.8395,
    timestamp: '2026-10-26T10:00:00.000Z'
  });

  assert.equal(syncCount, null);
});

test('syncRiderLocationToOrders discards missing timestamp without falling back to current time', async () => {
  const syncCount = await syncRiderLocationToOrdersHandler('driver1', null, {
    latitude: 9.3639,
    longitude: 78.8395
    // Missing timestamp
  });

  assert.equal(syncCount, null);
});

test('syncRiderLocationToOrders drops stale GPS events when order already has newer coordinates', async () => {
  // Order already has coordinates at 10:05:00
  await db.collection('orders').doc('ord_telemetry_stale').set({
    status: 'out-delivery',
    driverId: 'driver1',
    driverLocation: {
      latitude: 9.3640,
      longitude: 78.8396,
      timestamp: '2026-10-26T10:05:00.000Z'
    }
  });

  // Stale packet arrives with timestamp 10:01:00
  const staleData = {
    latitude: 9.3600,
    longitude: 78.8300,
    timestamp: '2026-10-26T10:01:00.000Z',
    isTracking: true
  };

  const syncCount = await syncRiderLocationToOrdersHandler('driver1', null, staleData);
  assert.equal(syncCount, 0); // Dropped, not written

  // Telemetry must still have newer location
  const orderDoc = await db.collection('orders').doc('ord_telemetry_stale').get();
  assert.equal(orderDoc.data().driverLocation.latitude, 9.3640);
  assert.equal(orderDoc.data().driverLocation.timestamp, '2026-10-26T10:05:00.000Z');
});

// ============================================================================
// 4. ORDER ASSIGNMENT & RIDER CONCURRENCY TESTS
// ============================================================================

test('assignOrderHandler allows admin to assign order to approved driver', async () => {
  await db.collection('orders').doc('ord_assign_1').set({
    status: 'confirmed',
    driverId: null
  });

  const adminAuth = { uid: 'adminUser' };
  const res = await assignOrderHandler({ orderId: 'ord_assign_1', driverId: 'driver1' }, adminAuth);

  assert.equal(res.success, true);
  assert.equal(res.driverId, 'driver1');

  const orderDoc = await db.collection('orders').doc('ord_assign_1').get();
  assert.equal(orderDoc.data().status, 'assigned');
  assert.equal(orderDoc.data().driverId, 'driver1');

  const driverDoc = await db.collection('users').doc('driver1').get();
  assert.ok(driverDoc.data().assignedOrders.includes('ord_assign_1'));
});

test('assignOrderHandler rejects non-admin callers', async () => {
  await db.collection('orders').doc('ord_assign_2').set({
    status: 'confirmed',
    driverId: null
  });

  const customerAuth = { uid: 'customer1' };
  await assert.rejects(
    async () => assignOrderHandler({ orderId: 'ord_assign_2', driverId: 'driver1' }, customerAuth),
    (err) => err.code === 'permission-denied'
  );
});

test('assignOrderHandler rejects assignment to pending (unapproved) rider', async () => {
  await db.collection('orders').doc('ord_assign_3').set({
    status: 'confirmed',
    driverId: null
  });

  const adminAuth = { uid: 'adminUser' };
  await assert.rejects(
    async () => assignOrderHandler({ orderId: 'ord_assign_3', driverId: 'pendingDriver' }, adminAuth),
    (err) => err.code === 'permission-denied'
  );
});

test('assignOrderHandler prevents assigning delivered or cancelled orders', async () => {
  await db.collection('orders').doc('ord_delivered').set({
    status: 'delivered',
    driverId: 'driver1'
  });

  const adminAuth = { uid: 'adminUser' };
  await assert.rejects(
    async () => assignOrderHandler({ orderId: 'ord_delivered', driverId: 'driver2' }, adminAuth),
    (err) => err.code === 'failed-precondition'
  );
});

test('assignOrderHandler prevents accidental double assignment without allowReassign', async () => {
  await db.collection('orders').doc('ord_already_assigned').set({
    status: 'assigned',
    driverId: 'driver1',
    driverName: 'Rider One'
  });

  const adminAuth = { uid: 'adminUser' };

  // Attempt reassign to driver2 without allowReassign
  await assert.rejects(
    async () => assignOrderHandler({ orderId: 'ord_already_assigned', driverId: 'driver2' }, adminAuth),
    (err) => err.code === 'already-exists'
  );
});

test('assignOrderHandler cleans up previous driver on explicit reassignment', async () => {
  await db.collection('orders').doc('ord_reassign').set({
    status: 'assigned',
    driverId: 'driver1',
    driverName: 'Rider One'
  });
  await db.collection('users').doc('driver1').update({
    assignedOrders: ['ord_reassign']
  });

  const adminAuth = { uid: 'adminUser' };

  const res = await assignOrderHandler(
    { orderId: 'ord_reassign', driverId: 'driver2', allowReassign: true },
    adminAuth
  );
  assert.equal(res.success, true);
  assert.equal(res.driverId, 'driver2');

  // Verify previous driver had order removed
  const prevDriverDoc = await db.collection('users').doc('driver1').get();
  assert.ok(!prevDriverDoc.data().assignedOrders.includes('ord_reassign'));

  // Verify new driver has order added
  const newDriverDoc = await db.collection('users').doc('driver2').get();
  assert.ok(newDriverDoc.data().assignedOrders.includes('ord_reassign'));
});

test('assignOrderHandler prevents concurrent race where two admins assign different drivers', async () => {
  await db.collection('orders').doc('ord_race').set({
    status: 'confirmed',
    driverId: null
  });

  const adminAuth = { uid: 'adminUser' };

  // Run 2 simultaneous assignments for different drivers without allowReassign
  const results = await Promise.allSettled([
    assignOrderHandler({ orderId: 'ord_race', driverId: 'driver1' }, adminAuth),
    assignOrderHandler({ orderId: 'ord_race', driverId: 'driver2' }, adminAuth)
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  // Exactly one must succeed, and the other must be rejected with already-exists
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, 'already-exists');
});
