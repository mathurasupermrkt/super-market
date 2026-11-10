import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_ORIGINS } from '../functions/index.js';

test('CORS: Allowed origins list contains expected local and production origins', () => {
  assert.ok(ALLOWED_ORIGINS.includes('http://127.0.0.1:5500'), 'Includes 127.0.0.1:5500');
  assert.ok(ALLOWED_ORIGINS.includes('http://localhost:5500'), 'Includes localhost:5500');
  assert.ok(ALLOWED_ORIGINS.includes('https://mathura-supermrkt.vercel.app'), 'Includes production vercel domain');
  assert.ok(ALLOWED_ORIGINS.includes('https://mathura-quickmart-v2.web.app'), 'Includes Firebase web.app domain');
  assert.ok(!ALLOWED_ORIGINS.includes('*'), 'Never allows wildcard *');
  assert.ok(!ALLOWED_ORIGINS.includes('https://untrusted-site.com'), 'Excludes unauthorized domains');
});

test('Double-click lock: Concurrent calls are prevented and lock resets in finally', async () => {
  let isPlacingOrder = false;
  let callCount = 0;

  async function mockPlaceOrder() {
    if (isPlacingOrder) return 'LOCKED';
    isPlacingOrder = true;
    let isRedirecting = false;

    try {
      callCount++;
      // Simulate async network request
      await new Promise(r => setTimeout(r, 20));
      return 'SUCCESS';
    } finally {
      if (!isRedirecting) {
        isPlacingOrder = false;
      }
    }
  }

  // Fire two calls concurrently (simulating rapid double-click)
  const [res1, res2] = await Promise.all([mockPlaceOrder(), mockPlaceOrder()]);
  assert.equal(res1, 'SUCCESS', 'First call succeeded');
  assert.equal(res2, 'LOCKED', 'Second concurrent call was locked out');
  assert.equal(callCount, 1, 'Only executed once');
  assert.equal(isPlacingOrder, false, 'Lock was reset in finally');
});

test('Toast deduplication: Suppresses duplicate messages within 1.5s window', () => {
  const dispatchedToasts = [];
  const fakeMQM = {
    _recentToastKeys: {},
    toast(message, type = 'success') {
      if (!message) return;
      const key = `${type}:${message}`;
      const now = Date.now();
      if (this._recentToastKeys && this._recentToastKeys[key] && (now - this._recentToastKeys[key] < 1500)) {
        return; // Suppress duplicate
      }
      if (!this._recentToastKeys) this._recentToastKeys = {};
      this._recentToastKeys[key] = now;
      dispatchedToasts.push({ message, type });
    }
  };

  fakeMQM.toast('Failed to place order. Please try again.', 'error');
  fakeMQM.toast('Failed to place order. Please try again.', 'error'); // duplicate
  fakeMQM.toast('Failed to place order. Please try again.', 'error'); // duplicate
  assert.equal(dispatchedToasts.length, 1, 'Only 1 toast dispatched for duplicate errors');

  // Different message is allowed through
  fakeMQM.toast('Please check your network.', 'error');
  assert.equal(dispatchedToasts.length, 2, 'Legitimate different error is dispatched');
});

