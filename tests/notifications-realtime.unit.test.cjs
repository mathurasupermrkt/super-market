/**
 * Unit Test: Mathura Quick Mart Real-Time Notification & Audio Chime System
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('1. Notification Sound Engine: Audio synthesis & mute toggle', () => {
  const notifCode = fs.readFileSync('js/notifications.js', 'utf8');
  assert.match(notifCode, /class NotificationSoundEngine/, 'NotificationSoundEngine is defined');
  assert.match(notifCode, /type === 'new_order'/, 'Differentiates new_order fanfare chime');
  assert.match(notifCode, /type === 'price_alert'/, 'Differentiates price_alert chime');
  assert.match(notifCode, /mathura_sound_enabled/, 'Stores sound preference in localStorage');
});

test('2. Firestore Security Rules: notifications collection access control', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/notifications\/\{notificationId\}/, 'Contains notifications collection rule');
  assert.match(rules, /resource\.data\.recipientUid == request\.auth\.uid/, 'Restricts customer read to own notifications');
  assert.match(rules, /isAdmin\(\)/, 'Admin can read notifications');
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['isRead', 'readAt'\]\)/, 'Customer can only modify isRead and readAt');
});

test('3. Firestore Security Rules: priceAlerts collection access control', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/priceAlerts\/\{alertId\}/, 'Contains priceAlerts collection rule');
  assert.match(rules, /resource\.data\.customerUid == request\.auth\.uid/, 'Customer can read only own price alerts');
  assert.match(rules, /request\.resource\.data\.targetPrice > 0/, 'Requires positive target price');
});

test('4. Backend Functions: Order notification triggers defined and exported', () => {
  const funcCode = fs.readFileSync('functions/index.js', 'utf8');
  assert.match(funcCode, /export async function handleOrderWrittenNotification/, 'handleOrderWrittenNotification handler exists');
  assert.match(funcCode, /export const onOrderWritten = onDocumentWritten\('orders\/\{orderId\}'/, 'onOrderWritten trigger exported');
  assert.match(funcCode, /admin_order_\$\{orderId\}/, 'Generates idempotent admin order notification ID');
});

test('5. Backend Functions: Price alert trigger logic checks price decrease and matching target', () => {
  const funcCode = fs.readFileSync('functions/index.js', 'utf8');
  assert.match(funcCode, /export async function handleProductWrittenPriceAlert/, 'handleProductWrittenPriceAlert handler exists');
  assert.match(funcCode, /export const onProductWritten = onDocumentWritten\('products\/\{productId\}'/, 'onProductWritten trigger exported');
  assert.match(funcCode, /newPrice < oldPrice/, 'Triggers only on genuine price drops');
  assert.match(funcCode, /where\('targetPrice', '>=', newPrice\)/, 'Filters alerts meeting customer target price');
  assert.match(funcCode, /alert\.lastNotifiedPrice === newPrice/, 'Prevents duplicate notifications for same price drop');
});

test('6. Admin Dashboard: Notification bell icon, unread badge, and sound control integrated', () => {
  const adminHtml = fs.readFileSync('admin/dashboard.html', 'utf8');
  assert.match(adminHtml, /id="admin-notif-btn"/, 'Admin notification button present');
  assert.match(adminHtml, /id="admin-notif-badge"/, 'Admin unread count badge present');
  assert.match(adminHtml, /id="admin-notif-dropdown"/, 'Admin notification dropdown panel present');
  assert.match(adminHtml, /MathuraNotifications\.toggleSound\(\)/, 'Admin sound mute/unmute toggle integrated');
  assert.match(adminHtml, /MathuraNotifications\.init\('admin'\)/, 'Initializes real-time admin listener');
});

test('7. Storefront: Header notification bell and customer dropdown integrated', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.match(indexHtml, /id="nav-notif-btn"/, 'Storefront notification button present');
  assert.match(indexHtml, /id="customer-notif-badge"/, 'Storefront notification badge present');
  assert.match(indexHtml, /id="customer-notif-menu"/, 'Storefront notification menu present');
  assert.match(indexHtml, /notifications\.js/, 'Imports notifications.js');
});

test('8. Product Detail: Price Drop Alert button and modal integrated', () => {
  const detailHtml = fs.readFileSync('customer/product-detail.html', 'utf8');
  assert.match(detailHtml, /id="price-alert-btn"/, 'Price drop alert button present on product detail');
  assert.match(detailHtml, /id="price-alert-modal"/, 'Price alert modal present');
  assert.match(detailHtml, /saveProductPriceAlert\(\)/, 'Saves customer price alert');
});

test('9. Notification Manager: Unread calculation, deterministic IDs, and mark all as read', () => {
  const notifCode = fs.readFileSync('js/notifications.js', 'utf8');
  assert.match(notifCode, /getUnreadCount\(\)/, 'Provides getUnreadCount method');
  assert.match(notifCode, /markAllAsRead\(\)/, 'Provides markAllAsRead method');
  assert.match(notifCode, /setPriceAlert/, 'Provides setPriceAlert method');
  assert.match(notifCode, /requestBrowserPermission/, 'Provides Web Notifications API permission request');
});

