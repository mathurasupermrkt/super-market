/**
 * Unit Test: Cart Synchronization & Button Functionality
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createCartEnvironment() {
  const localStorageData = {};
  const listeners = {};
  const domElements = new Map();

  const mockWindow = {
    location: {
      href: 'http://127.0.0.1:5500/index.html',
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
      querySelectorAll: (sel) => {
        const matches = [];
        domElements.forEach((el, key) => {
          if (sel === '[data-cart-count]' && el.hasAttribute && el.hasAttribute('data-cart-count')) {
            matches.push(el);
          } else if (sel.includes('.product-card-btn-container')) {
            if (el.className && el.className.includes('product-card-btn-container')) {
              if (sel.includes('data-btn-product-id="')) {
                const pid = sel.match(/data-btn-product-id="([^"]+)"/)[1];
                if (el.getAttribute('data-btn-product-id') === pid) matches.push(el);
              } else {
                matches.push(el);
              }
            }
          }
        });
        return matches;
      },
      getElementById: (id) => domElements.get(id) || null,
      createElement: (tag) => ({
        tagName: tag,
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        style: {},
        appendChild: () => {},
        remove: () => {}
      }),
      addEventListener: () => {},
      body: { appendChild: () => {} }
    },
    navigator: { userAgent: 'node' },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    performance: { now: () => Date.now() }
  };

  mockWindow.window = mockWindow;

  const appJsCode = fs.readFileSync('js/app.js', 'utf8');
  const context = vm.createContext(mockWindow);
  vm.runInContext(appJsCode, context);

  return {
    window: mockWindow,
    MathuraQuickMart: mockWindow.MathuraQuickMart,
    API: mockWindow.API,
    domElements
  };
}

test('1. Adding a product to cart updates count, subtotal, and persists to state', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const product = { id: 101, name: 'Fresh Milk', price: 30, stock: 10 };
  mqm.addToCart(product, 1);

  assert.equal(mqm.getCartCount(), 1);
  assert.equal(mqm.getCartTotal(), 30);
  assert.equal(mqm.getCart().length, 1);
  assert.equal(mqm.getCart()[0].name, 'Fresh Milk');
  assert.equal(mqm.getCart()[0].qty, 1);
});

test('2. Adding the same product again increases quantity and prevents duplicate entries', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const product = { id: 101, name: 'Fresh Milk', price: 30, stock: 10 };
  mqm.addToCart(product, 1);
  mqm.addToCart(product, 2);

  assert.equal(mqm.getCart().length, 1, 'Should not create duplicate cart entry');
  assert.equal(mqm.getCart()[0].qty, 3);
  assert.equal(mqm.getCartCount(), 3);
  assert.equal(mqm.getCartTotal(), 90);
});

test('3. updateCartQty correctly modifies item quantity', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const product = { id: 101, name: 'Fresh Milk', price: 30, stock: 10 };
  mqm.addToCart(product, 1);
  mqm.updateCartQty(101, 5);

  assert.equal(mqm.getCart()[0].qty, 5);
  assert.equal(mqm.getCartCount(), 5);
  assert.equal(mqm.getCartTotal(), 150);
});

test('4. Decreasing quantity to 0 removes the product from cart', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const product = { id: 101, name: 'Fresh Milk', price: 30, stock: 10 };
  mqm.addToCart(product, 1);
  mqm.updateCartQty(101, 0);

  assert.equal(mqm.getCart().length, 0);
  assert.equal(mqm.getCartCount(), 0);
  assert.equal(mqm.getCartTotal(), 0);
});

test('5. Out-of-stock products cannot be added to cart', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const outOfStock = { id: 102, name: 'Out of stock apples', price: 100, stock: 0 };
  mqm.addToCart(outOfStock, 1);

  assert.equal(mqm.getCart().length, 0, 'Out of stock product must not be added');
});

test('6. Cart validates against maximum stock limit', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const limitedStock = { id: 103, name: 'Limited Honey', price: 200, stock: 2 };
  mqm.addToCart(limitedStock, 1);
  assert.equal(mqm.getCart()[0].qty, 1);

  // Trying to add 2 more when only 2 exist in total
  mqm.addToCart(limitedStock, 2);
  assert.equal(mqm.getCart()[0].qty, 1, 'Quantity should not exceed maximum stock');
});

test('7. renderCartButtonHtml returns ADD when qty=0, quantity counter when qty>0, and OUT OF STOCK when stock=0', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  // Case 1: Out of stock
  const outOfStockHtml = env.window.renderCartButtonHtml(201, 0);
  assert.ok(outOfStockHtml.includes('OUT OF STOCK'), 'Must indicate OUT OF STOCK');

  // Case 2: In stock, not in cart
  const addHtml = env.window.renderCartButtonHtml(201, 10);
  assert.ok(addHtml.includes('ADD'), 'Must show ADD button');
  assert.ok(!addHtml.includes('qty-counter'), 'Must not show qty counter when not in cart');

  // Case 3: In cart
  mqm.addToCart({ id: 201, name: 'Rice', price: 50, stock: 10 }, 2);
  const inCartHtml = env.window.renderCartButtonHtml(201, 10);
  assert.ok(inCartHtml.includes('qty-counter'), 'Must show qty-counter when in cart');
  assert.ok(inCartHtml.includes('<span>2</span>'), 'Must display quantity 2');
  assert.ok(inCartHtml.includes('-'), 'Must include minus button');
  assert.ok(inCartHtml.includes('+'), 'Must include plus button');
});

test('8. updateProductCardButtons updates all matching button containers in DOM', () => {
  const env = createCartEnvironment();
  const mqm = env.MathuraQuickMart;

  const container1 = {
    className: 'product-card-btn-container',
    innerHTML: '',
    getAttribute: (attr) => attr === 'data-btn-product-id' ? '301' : null,
    hasAttribute: (attr) => attr === 'data-btn-product-id'
  };
  env.domElements.set('btn-301', container1);

  // Register product in API
  env.API.products = env.API.products || [];
  env.API.products.push({ id: 301, name: 'Sugar', price: 40, stock: 15 });

  // Initially not in cart -> ADD button
  env.window.updateProductCardButtons(301);
  assert.ok(container1.innerHTML.includes('ADD'));

  // Add to cart -> container updates to qty-counter
  mqm.addToCart({ id: 301, name: 'Sugar', price: 40, stock: 15 }, 1);
  assert.ok(container1.innerHTML.includes('qty-counter'), 'Container must update to qty-counter');
  assert.ok(container1.innerHTML.includes('<span>1</span>'), 'Container must show 1');

  // Remove from cart -> container updates back to ADD
  mqm.removeFromCart(301);
  assert.ok(container1.innerHTML.includes('ADD'), 'Container must revert to ADD');
});

