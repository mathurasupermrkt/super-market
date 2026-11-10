/**
 * Unit Test: My Orders Navigation & Admin Role Verification
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createEnvironment(initialState = {}, authUser = null, firestoreUserData = null) {
  const localStorageData = {
    mathuraquickmart_state: JSON.stringify(initialState)
  };

  const listeners = {};
  let currentHref = 'http://127.0.0.1:5500/index.html';
  let replacedHref = null;

  const mockWindow = {
    location: {
      get href() { return currentHref; },
      set href(val) { currentHref = val; },
      replace(val) { replacedHref = val; currentHref = val; },
      search: '',
      hash: '',
      hostname: '127.0.0.1'
    },
    addEventListener: (evt, handler) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(handler);
    },
    dispatchEvent: (evt) => {
      const list = listeners[evt.type] || [];
      list.forEach(fn => fn(evt));
    },
    localStorage: {
      getItem: (k) => localStorageData[k] || null,
      setItem: (k, v) => { localStorageData[k] = String(v); },
      removeItem: (k) => { delete localStorageData[k]; }
    },
    document: {
      documentElement: { setAttribute: () => {} },
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ classList: { add: () => {} }, style: {}, appendChild: () => {}, remove: () => {} }),
      addEventListener: () => {},
      body: { appendChild: () => {} }
    },
    navigator: { userAgent: 'node' },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    performance: { now: () => Date.now() },
    IntersectionObserver: class { observe() {} disconnect() {} }
  };

  mockWindow.window = mockWindow;

  // Mock Firebase Auth
  mockWindow.FirebaseAuth = { currentUser: authUser };
  mockWindow.FirebaseAuthFns = {
    onAuthStateChanged: (auth, cb) => {
      cb(authUser);
      return () => {};
    }
  };

  // Mock Firestore
  mockWindow.FirebaseDB = {};
  mockWindow.Firestore = {
    collection: () => ({}),
    query: () => ({}),
    where: () => ({}),
    getDocs: async () => ({ empty: true, forEach: () => {} }),
    doc: (db, col, id) => ({ path: `${col}/${id}` }),
    getDoc: async () => ({
      exists: () => firestoreUserData !== null,
      data: () => firestoreUserData || {}
    })
  };

  const appCode = fs.readFileSync('js/app.js', 'utf8');
  vm.createContext(mockWindow);
  vm.runInContext(appCode, mockWindow);

  mockWindow.MathuraQuickMart.init();

  return { mockWindow, getHref: () => currentHref, getReplacedHref: () => replacedHref };
}

test('1. Admin user: goToOrders redirects to Admin Dashboard Orders section', async () => {
  const env = createEnvironment(
    { user: { uid: 'U2nUX9RlRZPXfvzXZ0Tu1UyNv0LW', role: 'admin', email: 'mathurasupermrkt@gmail.com' } },
    { uid: 'U2nUX9RlRZPXfvzXZ0Tu1UyNv0LW', email: 'mathurasupermrkt@gmail.com', emailVerified: true },
    { role: 'admin', email: 'mathurasupermrkt@gmail.com' }
  );

  await env.mockWindow.MathuraQuickMart.goToOrders();
  assert.equal(env.getHref(), '/admin/dashboard.html?tab=orders');
});

test('2. Customer user: goToOrders redirects to Customer My Orders', async () => {
  const env = createEnvironment(
    { user: { uid: 'cust123', role: 'customer', email: 'vikram12@gmail.com' } },
    { uid: 'cust123', email: 'vikram12@gmail.com', emailVerified: true },
    { role: 'customer', email: 'vikram12@gmail.com' }
  );

  await env.mockWindow.MathuraQuickMart.goToOrders();
  assert.equal(env.getHref(), '/customer/my-orders.html');
});

test('3. Client-side role spoofing attempt: localStorage role=admin rejected without valid Firebase admin auth', async () => {
  // Attacker sets localStorage.state.user.role = 'admin' but Firebase auth is regular customer or null
  const env = createEnvironment(
    { user: { uid: 'fake_admin', role: 'admin', email: 'attacker@gmail.com' } },
    { uid: 'fake_admin', email: 'attacker@gmail.com', emailVerified: true },
    { role: 'customer', email: 'attacker@gmail.com' } // Firestore says customer!
  );

  const isAdmin = await env.mockWindow.MathuraQuickMart.verifyIsAdmin();
  assert.equal(isAdmin, false, 'Spoofed admin role must not be verified as admin');

  await env.mockWindow.MathuraQuickMart.goToOrders();
  assert.equal(env.getHref(), '/customer/my-orders.html');
});

test('4. Signed-out visitor: goToOrders invokes requireAuth and redirects to login', async () => {
  const env = createEnvironment(
    { user: null },
    null,
    null
  );

  await env.mockWindow.MathuraQuickMart.goToOrders();
  assert.equal(env.getHref(), '/customer/login.html');
});

test('5. Master Admin by hardcoded UID is recognized securely', async () => {
  const env = createEnvironment(
    { user: { uid: '7SBL73wlj7OxKBsMExoJNhdrDTU2', role: 'admin' } },
    { uid: '7SBL73wlj7OxKBsMExoJNhdrDTU2', email: 'master@store.com', emailVerified: true },
    null
  );

  const isAdmin = await env.mockWindow.MathuraQuickMart.verifyIsAdmin();
  assert.equal(isAdmin, true);

  await env.mockWindow.MathuraQuickMart.goToOrders();
  assert.equal(env.getHref(), '/admin/dashboard.html?tab=orders');
});
