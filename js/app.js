/**
 * Mathura Quick Mart - Shared Application Engine
 * State management, cart, wishlist, auth, toast notifications
 */

'use strict';

// ============ STATE MANAGEMENT ============
const MathuraQuickMart = {
  // Centralized Store Configuration
  config: {
    whatsappNumber: "919876543210", // Default store WhatsApp number in international format (no +, no spaces, no dashes)
    storeName: "Mathura Quick Mart",
    supportEmail: "support@mathuraquickmart.in",
    storeLocation: "Madakottan, Ramanathapuram, Tamil Nadu - 623504"
  },

  // Store state
  state: {
    user: null,
    cart: [],
    wishlist: [],
    orders: [],
    returns: [],
    notifications: [],
    recentlyViewed: [],
    searchHistory: [],
  },

  // ============ WHATSAPP UTILITIES (CLICK-TO-CHAT WA.ME) ============
  getWhatsAppNumber() {
    try {
      const saved = localStorage.getItem('mathuraquickmart_whatsapp_number');
      if (saved) return this.cleanPhoneNumber(saved);
      if (this.storeSettings && this.storeSettings.whatsappNumber) {
        return this.cleanPhoneNumber(this.storeSettings.whatsappNumber);
      }
    } catch (e) {}
    return this.cleanPhoneNumber(this.config.whatsappNumber);
  },

  setWhatsAppNumber(num) {
    const cleaned = this.cleanPhoneNumber(num);
    try {
      localStorage.setItem('mathuraquickmart_whatsapp_number', cleaned);
    } catch (e) {}
    this.config.whatsappNumber = cleaned;
    return cleaned;
  },

  cleanPhoneNumber(phone) {
    if (!phone) return "919876543210";
    let cleaned = String(phone).trim().replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = '91' + cleaned.substring(1);
    }
    return cleaned || "919876543210";
  },

  openWhatsApp(message, targetPhone) {
    const phone = targetPhone ? this.cleanPhoneNumber(targetPhone) : this.getWhatsAppNumber();
    const encoded = encodeURIComponent(message || '');
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank');
    return url;
  },

  // WhatsApp Message Builders
  buildCartWhatsAppMessage(cartItems, summary = {}) {
    const items = cartItems || this.getCart() || [];
    if (items.length === 0) return '';
    
    let itemsText = items.map((item, idx) => {
      const unit = item.weight || item.unit || '';
      const name = item.name + (unit ? ` ${unit}` : '');
      const price = item.price || 0;
      const qty = item.qty || 1;
      return `${idx + 1}. ${name}\n   Quantity: ${qty}\n   Price: ₹${price * qty}`;
    }).join('\n\n');

    const subtotal = summary.subtotal !== undefined ? summary.subtotal : this.getCartTotal();
    const delivery = summary.deliveryFee !== undefined ? (summary.deliveryFee === 0 ? 'FREE' : `₹${summary.deliveryFee}`) : 'FREE';
    const discount = summary.discount ? `\nDiscount: -₹${Math.round(summary.discount)}` : '';
    const total = summary.total !== undefined ? summary.total : (subtotal - (summary.discount || 0));

    return `Hello Mathura Quick Mart 👋\n\nI would like to order these products:\n\n🛒 Cart Items\n\n${itemsText}\n\n--------------------------------\n\nSubtotal: ₹${Math.round(subtotal)}${discount}\nDelivery: ${delivery}\nTotal: ₹${Math.round(total)}\n\nPlease confirm my order.\n\nThank you!\nMathura Quick Mart`;
  },

  buildProductWhatsAppMessage(product) {
    if (!product) return 'Hello Mathura Quick Mart 👋\n\nI have an enquiry about your grocery products.';
    const name = product.name || 'Product';
    const weight = product.weight || product.unit || '1 unit';
    const price = product.price || 0;
    return `Hello Mathura Quick Mart 👋\n\nI am interested in:\n\nProduct: ${name}\nQuantity: ${weight}\nPrice: ₹${price}\n\nIs this product available?`;
  },

  buildCheckoutWhatsAppMessage(orderData) {
    const data = orderData || {};
    const items = data.items || this.getCart() || [];
    let itemsText = items.map(item => {
      const unit = item.weight || item.unit || '';
      const name = item.name + (unit ? ` ${unit}` : '');
      const price = item.price || 0;
      const qty = item.qty || 1;
      return `🛒 ${name} × ${qty}\n₹${price * qty}`;
    }).join('\n\n');

    const subtotal = Math.round(data.subtotal || this.getCartTotal());
    const delivery = data.deliveryFee ? `₹${data.deliveryFee}` : 'FREE';
    const discount = data.discount ? `\nDiscount: ₹${Math.round(data.discount)}` : '';
    const total = Math.round(data.total || (subtotal - (data.discount || 0)));
    const address = data.address || 'Madakottan, Ramanathapuram, Tamil Nadu - 623504';

    return `Hello Mathura Quick Mart 👋\n\nMy order details:\n\nOrder Items:\n--------------------------------\n${itemsText}\n--------------------------------\n\nSubtotal: ₹${subtotal}\nDelivery: ${delivery}${discount}\n\nTOTAL: ₹${total}\n\nDelivery Address:\n${address}\n\nThank you!`;
  },

  buildOrderPlacedWhatsAppMessage(order) {
    if (!order) return '';
    const items = order.items || [];
    let itemsText = items.map(item => {
      const unit = item.weight || item.unit || '';
      const name = item.name + (unit ? ` ${unit}` : '');
      const qty = item.qty || 1;
      return `🛒 ${name} × ${qty}`;
    }).join('\n');

    const total = Math.round(order.total || order.subtotal || 0);
    const address = order.address || order.customerAddress || 'Customer registered address';

    return `Hello Mathura Quick Mart 👋\n\nI have placed an order.\n\nOrder ID: #${order.id}\n\nItems:\n${itemsText || 'Order Items'}\n\nTotal: ₹${total}\n\nDelivery Address:\n${address}\n\nPlease confirm my order.`;
  },

  buildOrderSupportWhatsAppMessage(order) {
    if (!order) return 'Hello Mathura Quick Mart 👋\n\nI need help regarding my order.';
    const total = Math.round(order.total || order.subtotal || 0);
    const status = (order.status || 'Confirmed').replace(/[-_]/g, ' ');
    const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
    return `Hello Mathura Quick Mart 👋\n\nI need help regarding my order.\n\nOrder ID: #${order.id}\n\nOrder Total: ₹${total}\n\nOrder Status: ${formattedStatus}\n\nPlease assist me.`;
  },

  buildDeliverySupportWhatsAppMessage(orderId) {
    const id = orderId || 'N/A';
    return `Hello Mathura Quick Mart 👋\n\nI need help regarding my active delivery.\n\nOrder ID: #${id}\n\nPlease assist me with delivery status.`;
  },

  buildAdminCustomerWhatsAppMessage(order) {
    if (!order) return '';
    const custName = order.customerName || order.customer || 'Customer';
    const status = (order.status || 'Confirmed').replace(/[-_]/g, ' ');
    const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
    const total = Math.round(order.total || order.subtotal || 0);
    return `Hello ${custName} 👋\n\nThis is Mathura Quick Mart regarding your order.\n\nOrder ID: #${order.id}\n\nOrder Status: ${formattedStatus}\n\nTotal Amount: ₹${total}\n\nThank you for shopping with us!`;
  },

  // Initialize from localStorage
  init() {
    this.initTheme();
    this.loadState();
    this.renderCartBadge();
    this.renderWishlistBadge();
    this.checkAuth();
    this.initSearch();
    this.initMobileMenu();
    this.initAnimations();
    this.initStoreStatusListener();
    this.initOrderRulesListener();

    const setupAuthListener = () => {
      const auth = window.FirebaseAuth;
      const authFns = window.FirebaseAuthFns;
      if (auth && authFns) {
        authFns.onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log("🔒 Firebase Auth State: Logged in as", user.email);
            API.syncFromFirestore();
          } else {
            console.log("🔓 Firebase Auth State: Logged out");
          }
        });
      }
    };

    // Check if Firebase is already loaded, otherwise listen for firebase-ready
    if (window.FirebaseDB) {
      API.syncFromFirestore();
      setupAuthListener();
    } else {
      window.addEventListener('firebase-ready', () => {
        API.syncFromFirestore();
        setupAuthListener();
      });
    }
  },

  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem('mathuraquickmart_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeToggleUI(savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mathuraquickmart_theme', next);
    this.updateThemeToggleUI(next);
    this.toast(`Switched to ${next === 'dark' ? 'Dark 🌙' : 'Light ☀️'} mode`, 'info');
  },

  updateThemeToggleUI(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    });
  },

  // Load persisted state
  loadState() {
    try {
      const saved = localStorage.getItem('mathuraquickmart_state');
      if (saved) {
        const parsed = JSON.parse(saved);

        // Deduplicate and merge cart items
        if (parsed.cart && Array.isArray(parsed.cart)) {
          const cartMap = new Map();
          parsed.cart.forEach(item => {
            if (!item || !item.id) return;
            const key = String(item.id);
            if (cartMap.has(key)) {
              cartMap.get(key).qty = (cartMap.get(key).qty || 1) + (item.qty || 1);
            } else {
              cartMap.set(key, { ...item, id: parseInt(item.id) || item.id, qty: item.qty || 1 });
            }
          });
          parsed.cart = Array.from(cartMap.values());
        }

        // Deduplicate wishlist items
        if (parsed.wishlist && Array.isArray(parsed.wishlist)) {
          const wishMap = new Map();
          parsed.wishlist.forEach(item => {
            if (!item || !item.id) return;
            const key = String(item.id);
            if (!wishMap.has(key)) {
              wishMap.set(key, { ...item, id: parseInt(item.id) || item.id });
            }
          });
          parsed.wishlist = Array.from(wishMap.values());
        }

        // Deduplicate orders
        if (parsed.orders && Array.isArray(parsed.orders)) {
          const orderMap = new Map();
          parsed.orders.forEach(order => {
            if (!order || !order.id) return;
            const key = String(order.id);
            if (!orderMap.has(key)) {
              orderMap.set(key, order);
            }
          });
          parsed.orders = Array.from(orderMap.values());
        }

        this.state = { ...this.state, ...parsed };
      }
    } catch(e) { console.warn('State load error:', e); }
  },

  // Get strictly the logged-in customer's orders (deduplicated & sorted)
  getUserOrders() {
    const user = this.state.user;
    
    // Source orders from local user state first, then API.orders
    const sourceOrders = (this.state.orders && this.state.orders.length > 0)
      ? this.state.orders 
      : (API.orders || []);

    // 1. Deduplicate by order.id
    const ordMap = new Map();
    sourceOrders.forEach(o => {
      if (!o || !o.id) return;
      const key = String(o.id).trim();
      if (!ordMap.has(key)) ordMap.set(key, o);
    });
    const allUnique = Array.from(ordMap.values());

    // If not logged in, return empty (guests have no order history yet)
    if (!user) return [];

    // Admin & Delivery roles can see all unique orders
    if (user.role === 'admin' || user.role === 'delivery') {
      return allUnique.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    }

    // Strict customer filtering by UID, Email, or Phone
    const userUid = String(user.uid || '').trim();
    const userEmail = (user.email || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/[^0-9]/g, '');

    const filtered = allUnique.filter(o => {
      const oUid = String(o.userId || o.customerId || '').trim();
      if (userUid && oUid && oUid === userUid) return true;

      const oEmail = (o.customerEmail || o.email || '').toLowerCase().trim();
      if (userEmail && oEmail && oEmail === userEmail) return true;

      const oPhone = (o.customerPhone || o.phone || '').replace(/[^0-9]/g, '');
      if (userPhone && oPhone && (userPhone === oPhone || userPhone.endsWith(oPhone) || oPhone.endsWith(userPhone))) return true;

      return false;
    });

    return filtered.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  },

  // Save state to localStorage
  saveState() {
    try {
      localStorage.setItem('mathuraquickmart_state', JSON.stringify(this.state));
    } catch(e) { console.warn('State save error:', e); }
    try {
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: this.state.cart } }));
    } catch(_) {}
  },

    setUserLocation(lat, lng) {
      this.state.userLocation = { lat, lng };
      this.saveState();
      this.toast('Location set to (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')', 'success');
    },

  // ============ AUTH ============
  checkAuth() {
    const user = this.state.user;
    const authLinks = document.querySelectorAll('[data-auth]');
    const guestLinks = document.querySelectorAll('[data-guest]');
    const userNameEls = document.querySelectorAll('[data-username]');

    if (user) {
      authLinks.forEach(el => el.style.display = '');
      guestLinks.forEach(el => el.style.display = 'none');
      userNameEls.forEach(el => el.textContent = user.name || user.email);
    } else {
      authLinks.forEach(el => el.style.display = 'none');
      guestLinks.forEach(el => el.style.display = '');
    }
  },

  login(user) {
    this.state.user = user;
    this.saveState();
    this.checkAuth();
    this.toast('Welcome back, ' + user.name + '! 👋', 'success');
    // Restore cart, wishlist, orders from Firestore for this user
    if (user.uid) this._loadUserFirestoreData(user.uid);
  },

  logout() {
    const userRole = this.state.user ? this.state.user.role : 'customer';
    this.state.user = null;
    this.saveState();
    this.toast('Logged out successfully', 'success');

    // Sign out from Firebase Auth if available
    if (window.FirebaseAuth && window.FirebaseAuthFns) {
      window.FirebaseAuthFns.signOut(window.FirebaseAuth).catch(() => {});
    } else {
      window.addEventListener('firebase-ready', () => {
        window.FirebaseAuthFns.signOut(window.FirebaseAuth).catch(() => {});
      }, { once: true });
    }

    // Redirect to the correct portal login page based on role
    const redirectTo = (userRole === 'admin' || userRole === 'delivery')
      ? '/admin/login.html'
      : '/customer/login.html';
    setTimeout(() => { window.location.href = redirectTo; }, 800);
  },

  goToDashboard(e) {
    if (e) e.preventDefault();
    if (!this.state.user) {
      window.location.href = '/customer/login.html';
      return;
    }
    const role = this.state.user.role;
    if (role === 'admin') {
      window.location.href = '/admin/dashboard.html';
    } else if (role === 'delivery') {
      window.location.href = '/delivery/dashboard.html';
    } else {
      window.location.href = '/customer/dashboard.html';
    }
  },

  getAuthenticatedFirebaseUser() {
    return new Promise((resolve) => {
      const auth = window.FirebaseAuth;
      const authFns = window.FirebaseAuthFns;

      if (!auth || !authFns) {
        let timer = null;
        const onReady = () => {
          if (timer) clearTimeout(timer);
          resolve(this.getAuthenticatedFirebaseUser());
        };
        timer = setTimeout(() => {
          window.removeEventListener('firebase-ready', onReady);
          resolve(null);
        }, 2500);
        window.addEventListener('firebase-ready', onReady, { once: true });
        return;
      }

      if (auth.currentUser) {
        return resolve(auth.currentUser);
      }

      let resolved = false;
      let unsubscribe = null;
      try {
        unsubscribe = authFns.onAuthStateChanged(auth, (user) => {
          if (!resolved) {
            resolved = true;
            if (typeof unsubscribe === 'function') unsubscribe();
            resolve(user);
          }
        });
      } catch (_) {
        resolve(auth.currentUser || null);
        return;
      }

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (typeof unsubscribe === 'function') unsubscribe();
          resolve(auth.currentUser || null);
        }
      }, 1500);
    });
  },

  async verifyIsAdmin() {
    const ADMIN_UID = '7SBL73wlj7OxKBsMExoJNhdrDTU2';
    const ADMIN_EMAIL = 'mathurasupermrkt@gmail.com';

    // 1. Must have an authenticated Firebase session
    const fbUser = await this.getAuthenticatedFirebaseUser();
    if (!fbUser) {
      return false;
    }

    // 2. Check master admin by UID or verified email
    if (fbUser.uid === ADMIN_UID) return true;
    if (fbUser.email && fbUser.email.toLowerCase() === ADMIN_EMAIL && fbUser.emailVerified !== false) {
      return true;
    }

    // 3. Authoritative Firestore check: users/{uid}.role === 'admin'
    if (window.FirebaseDB && window.Firestore) {
      try {
        const { doc, getDoc } = window.Firestore;
        const snap = await getDoc(doc(window.FirebaseDB, 'users', fbUser.uid));
        if (snap.exists() && snap.data().role === 'admin') {
          return true;
        }
      } catch (e) {
        console.warn('verifyIsAdmin: Firestore lookup error:', e);
      }
    }

    return false;
  },

  async goToOrders(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // If not logged in in local state, check if Firebase has an active session
    let user = this.state.user;
    if (!user) {
      const fbUser = await this.getAuthenticatedFirebaseUser();
      if (!fbUser) {
        this.requireAuth();
        return;
      }
    }

    // Determine if the authenticated user is an admin
    const isAdmin = await this.verifyIsAdmin();
    if (isAdmin) {
      window.location.href = '/admin/dashboard.html?tab=orders';
    } else {
      window.location.href = '/customer/my-orders.html';
    }
  },

  requireAuth(role) {
    if (!this.state.user) {
      this.toast('Please log in to continue', 'warning');
      // Redirect to correct login page based on required role
      const loginPage = (role === 'admin') ? '/admin/login.html'
        : (role === 'delivery') ? '/admin/login.html'
        : '/customer/login.html';
      setTimeout(() => { window.location.href = loginPage; }, 800);
      return false;
    }
    // If a specific role is required, verify it
    if (role && this.state.user.role !== role) {
      this.toast('Access denied. Insufficient permissions.', 'error');
      const loginPage = (role === 'admin') ? '/admin/login.html' : '/customer/login.html';
      setTimeout(() => { window.location.href = loginPage; }, 1200);
      return false;
    }
    return true;
  },

  // ============ CART ============
  getCart() {
    if (!this.state.cart || !this.state.cart.length) {
      this.loadState();
    }
    return this.state.cart || [];
  },

  getCartCount() {
    if (!this.state.cart || !this.state.cart.length) {
      this.loadState();
    }
    return (this.state.cart || []).reduce((sum, item) => sum + (item.qty || 1), 0);
  },

  getCartTotal() {
    if (!this.state.cart || !this.state.cart.length) {
      this.loadState();
    }
    return (this.state.cart || []).reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
  },


  addToCart(product, qty = 1) {
    // Guard: do not add out-of-stock items
    if (product.stock !== undefined && product.stock !== null && product.stock <= 0) {
      this.toast(`${product.name} is out of stock`, 'warning');
      return;
    }
    const prodId = String(product.id);
    const existing = this.state.cart.find(i => String(i.id) === prodId);
    if (existing) {
      if (product.stock !== undefined && product.stock !== null && (existing.qty + qty) > product.stock) {
        this.toast(`Only ${product.stock} items available in stock`, 'warning');
        return;
      }
      existing.qty += qty;
    } else {
      this.state.cart.push({ ...product, id: parseInt(product.id) || product.id, qty });
    }
    this.saveState();
    this.renderCartBadge();
    this.toast(`${product.name} added to cart 🛒`, 'success');
    this.animateCartIcon();
    // Sync to Firestore
    this._syncCartItemToFirestore(product.id);
  },

  removeFromCart(productId) {
    const pId = String(productId);
    this.state.cart = this.state.cart.filter(i => String(i.id) !== pId);
    this.saveState();
    this.renderCartBadge();
    this.toast('Item removed from cart', 'success');
    // Sync to Firestore
    this._deleteCartItemFromFirestore(productId);
  },

  updateCartQty(productId, qty) {
    if (qty < 1) { this.removeFromCart(productId); return; }
    const pId = String(productId);
    const item = this.state.cart.find(i => String(i.id) === pId);
    if (item) {
      const product = (window.API && window.API.getProduct) ? window.API.getProduct(productId) : null;
      if (product && product.stock !== undefined && product.stock !== null && qty > product.stock) {
        this.toast(`Only ${product.stock} items available in stock`, 'warning');
        return;
      }
      item.qty = qty;
      this.saveState();
      this.renderCartBadge();
      // Sync to Firestore
      this._syncCartItemToFirestore(productId);
    }
  },

  clearCart() {
    this.state.cart = [];
    this.saveState();
    this.renderCartBadge();
    // Sync to Firestore
    this._clearFirestoreCart();
  },

  renderCartBadge() {
    const count = this.getCartCount();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });

    const totalEl = document.getElementById('nav-cart-total');
    if (totalEl) {
      const total = this.getCartTotal();
      totalEl.textContent = total > 0 ? '₹' + total : '₹0';
    }

    if (typeof updateProductCardButtons === 'function') {
      updateProductCardButtons();
    }
  },

  animateCartIcon() {
    const icons = document.querySelectorAll('[data-cart-icon]');
    icons.forEach(icon => {
      icon.classList.add('animate-bounce');
      setTimeout(() => icon.classList.remove('animate-bounce'), 1000);
    });
  },

  // ============ WISHLIST ============
  getWishlist() { return this.state.wishlist; },

  isInWishlist(productId) {
    const pId = String(productId);
    return this.state.wishlist.some(i => String(i.id) === pId);
  },

  toggleWishlist(product) {
    const pId = String(product.id);
    const idx = this.state.wishlist.findIndex(i => String(i.id) === pId);
    if (idx >= 0) {
      this.state.wishlist.splice(idx, 1);
      this.toast(`${product.name} removed from wishlist`, 'success');
      // Sync removal to Firestore
      this._deleteWishlistItemFromFirestore(product.id);
    } else {
      this.state.wishlist.push({ ...product, id: parseInt(product.id) || product.id });
      this.toast(`${product.name} added to wishlist ❤️`, 'success');
      // Sync addition to Firestore
      this._syncWishlistItemToFirestore(product);
    }
    this.saveState();
    this.renderWishlistBadge();
    return this.isInWishlist(product.id);
  },

  renderWishlistBadge() {
    const count = this.state.wishlist.length;
    document.querySelectorAll('[data-wishlist-count]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  },

  // ============ RECENTLY VIEWED ============
  addRecentlyViewed(product) {
    const list = this.state.recentlyViewed;
    const idx = list.findIndex(p => p.id === product.id);
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(product);
    if (list.length > 12) list.pop();
    this.saveState();
  },

  // ============ TOAST NOTIFICATIONS ============
  _recentToastKeys: {},

  toast(message, type = 'success', duration = 3500) {
    if (!message) return;
    const key = `${type}:${message}`;
    const now = Date.now();
    if (this._recentToastKeys && this._recentToastKeys[key] && (now - this._recentToastKeys[key] < 1500)) {
      return; // Deduplicate identical message within 1.5 seconds
    }
    if (!this._recentToastKeys) this._recentToastKeys = {};
    this._recentToastKeys[key] = now;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '✅'}</span>
      <span class="toast-message">${message}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ============ SEARCH ============
  initSearch() {
    const inputs = document.querySelectorAll('[data-search-input]');
    inputs.forEach(input => {
      let debounceTimer;
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.handleSearch(e.target.value, input);
        }, 300);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          window.location.href = `/customer/products.html?q=${encodeURIComponent(input.value)}`;
        }
      });
    });
  },

  handleSearch(query, input) {
    const dropdown = input.closest('.search-wrapper')?.querySelector('.search-dropdown');
    if (!dropdown) return;

    if (!query.trim()) { dropdown.style.display = 'none'; return; }

    const results = API.searchProducts(query);
    if (results.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = results.slice(0, 6).map(p => `
      <a class="search-result-item" href="/customer/product-detail.html?id=${p.id}">
        <span class="search-result-icon">🛒</span>
        <div>
          <div class="search-result-name">${p.name}</div>
          <div class="search-result-price">₹${p.price}</div>
        </div>
      </a>
    `).join('');

    dropdown.style.display = 'block';
  },

  // ============ MOBILE MENU ============
  initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const menu = document.getElementById('mobile-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        menu.classList.toggle('open');
        toggle.classList.toggle('open');
      });
    }

    // Admin sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (menu && !menu.contains(e.target) && !toggle?.contains(e.target)) {
        menu.classList.remove('open');
      }
      // Close dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(d => {
        if (!d.closest('.dropdown')?.contains(e.target)) {
          d.style.display = 'none';
        }
      });
    });
  },

  // ============ ANIMATIONS ============
  initAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          entry.target.style.opacity = '1';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-animate]').forEach(el => {
      el.style.opacity = '0';
      observer.observe(el);
    });
  },

  // ============ UTILITIES ============
  formatPrice(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0
    }).format(amount);
  },

  formatDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(date));
  },

  debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },

  // Counter animation
  animateCounter(el, from, to, duration = 1500) {
    const start = performance.now();
    const update = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const value = Math.round(from + (to - from) * this.easeOut(progress));
      el.textContent = value.toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  easeOut(t) { return 1 - Math.pow(1 - t, 3); },

  // ============ FIRESTORE USER DATA HELPERS ============

  /**
   * Returns { uid, db, fs } if Firebase is ready and user is logged in, else null.
   */
  _getFirestoreRefs() {
    const user = this.state.user;
    if (!user || !user.uid || !window.FirebaseDB || !window.Firestore) return null;
    return { uid: user.uid, db: window.FirebaseDB, fs: window.Firestore };
  },

  /** Write/update a single cart item to Firestore users/{uid}/cart/{productId} */
  async _syncCartItemToFirestore(productId) {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    const item = this.state.cart.find(i => i.id === productId);
    if (!item) { this._deleteCartItemFromFirestore(productId); return; }
    try {
      await fs.setDoc(fs.doc(db, 'users', uid, 'cart', productId.toString()), item);
    } catch (e) { console.warn('Firestore cart write error:', e); }
  },

  /** Remove a single cart item from Firestore users/{uid}/cart/{productId} */
  async _deleteCartItemFromFirestore(productId) {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    try {
      await fs.deleteDoc(fs.doc(db, 'users', uid, 'cart', productId.toString()));
    } catch (e) { console.warn('Firestore cart delete error:', e); }
  },

  /** Delete all documents from users/{uid}/cart sub-collection */
  async _clearFirestoreCart() {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    try {
      const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'cart'));
      const dels = [];
      snap.forEach(d => dels.push(fs.deleteDoc(fs.doc(db, 'users', uid, 'cart', d.id))));
      await Promise.all(dels);
    } catch (e) { console.warn('Firestore cart clear error:', e); }
  },

  /** Write/update a single wishlist item to Firestore users/{uid}/wishlist/{productId} */
  async _syncWishlistItemToFirestore(product) {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    try {
      await fs.setDoc(fs.doc(db, 'users', uid, 'wishlist', product.id.toString()), product);
    } catch (e) { console.warn('Firestore wishlist write error:', e); }
  },

  /** Remove a single wishlist item from Firestore users/{uid}/wishlist/{productId} */
  async _deleteWishlistItemFromFirestore(productId) {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    try {
      await fs.deleteDoc(fs.doc(db, 'users', uid, 'wishlist', productId.toString()));
    } catch (e) { console.warn('Firestore wishlist delete error:', e); }
  },

  /** Write/update a return item to Firestore users/{uid}/returns/{returnId} */
  async _syncReturnToFirestore(returnObj) {
    const refs = this._getFirestoreRefs();
    if (!refs) return;
    const { uid, db, fs } = refs;
    try {
      await fs.setDoc(fs.doc(db, 'users', uid, 'returns', returnObj.id.toString()), returnObj);
    } catch (e) { console.warn('Firestore returns write error:', e); }
  },

  /**
   * Load user's cart, wishlist, and orders from Firestore into state.
   * Called on login and on page load when Firebase becomes ready.
   */
  async _loadUserFirestoreData(uid) {
    if (!uid) return;

    const doLoad = async () => {
      if (!window.FirebaseDB || !window.Firestore) return;
      const db = window.FirebaseDB;
      const fs = window.Firestore;
      try {
        // 1. Load cart from users/{uid}/cart
        const cartSnap = await fs.getDocs(fs.collection(db, 'users', uid, 'cart'));
        if (!cartSnap.empty) {
          const cartMap = new Map();
          cartSnap.forEach(d => {
            const item = d.data();
            if (!item || !item.id) return;
            const key = String(item.id);
            if (cartMap.has(key)) {
              cartMap.get(key).qty = (cartMap.get(key).qty || 1) + (item.qty || 1);
            } else {
              cartMap.set(key, { ...item, id: parseInt(item.id) || item.id, qty: item.qty || 1 });
            }
          });
          this.state.cart = Array.from(cartMap.values());
          this.saveState();
          this.renderCartBadge();
        }

        // 2. Load wishlist from users/{uid}/wishlist
        const wishSnap = await fs.getDocs(fs.collection(db, 'users', uid, 'wishlist'));
        if (!wishSnap.empty) {
          const wishMap = new Map();
          wishSnap.forEach(d => {
            const item = d.data();
            if (!item || !item.id) return;
            const key = String(item.id);
            if (!wishMap.has(key)) {
              wishMap.set(key, { ...item, id: parseInt(item.id) || item.id });
            }
          });
          this.state.wishlist = Array.from(wishMap.values());
          this.saveState();
          this.renderWishlistBadge();
        }

        // 3. Load this user's orders (filtered strictly by userId / customerId)
        try {
          let ordersSnap = null;
          try {
            ordersSnap = await fs.getDocs(fs.query(fs.collection(db, 'orders'), fs.where('userId', '==', uid)));
          } catch (e1) {
            try {
              ordersSnap = await fs.getDocs(fs.query(fs.collection(db, 'orders'), fs.where('customerId', '==', uid)));
            } catch (e2) {
              console.warn('Orders query failed:', e2.message);
              ordersSnap = null;
            }
          }

          if (ordersSnap && !ordersSnap.empty) {
            const orderMap = new Map();
            const userEmail = (this.state.user?.email || '').toLowerCase().trim();
            const userPhone = (this.state.user?.phone || '').replace(/[^0-9]/g, '');

            ordersSnap.forEach(d => {
              const order = { id: d.id, ...d.data() };
              if (!order || !order.id) return;
              
              // Filter to this user
              const oUid = String(order.userId || order.customerId || '').trim();
              const oEmail = (order.customerEmail || order.email || '').toLowerCase().trim();
              const oPhone = (order.customerPhone || order.phone || '').replace(/[^0-9]/g, '');
              
              const isMatch = (oUid && oUid === uid) || 
                              (userEmail && oEmail && oEmail === userEmail) ||
                              (userPhone && oPhone && (userPhone === oPhone || userPhone.endsWith(oPhone) || oPhone.endsWith(userPhone)));

              if (isMatch) {
                const key = String(order.id);
                if (!orderMap.has(key)) {
                  orderMap.set(key, order);
                }
              }
            });

            const orders = Array.from(orderMap.values());
            orders.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            this.state.orders = orders;
            this.saveState();
          }
        } catch (e) { console.warn('Orders query failed:', e); }

        // 4. Load returns from users/{uid}/returns
        try {
          const returnsSnap = await fs.getDocs(fs.collection(db, 'users', uid, 'returns'));
          if (!returnsSnap.empty) {
            const returnMap = new Map();
            returnsSnap.forEach(d => {
              const r = d.data();
              if (!r || !r.id) return;
              const key = String(r.id);
              if (!returnMap.has(key)) {
                returnMap.set(key, r);
              }
            });
            const returns = Array.from(returnMap.values());
            returns.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
            this.state.returns = returns;
            this.saveState();
          } else {
            this.state.returns = [];
            this.saveState();
          }
        } catch (e) { console.warn('Returns query failed:', e); }

        console.log('✅ User Firestore data loaded for uid:', uid);
        window.dispatchEvent(new CustomEvent('user-data-ready'));
      } catch (e) { console.warn('User data load error:', e); }
    };

    if (window.FirebaseDB && window.Firestore) {
      doLoad();
    } else {
      window.addEventListener('firebase-ready', doLoad, { once: true });
    }
  },

  // ============ STORE STATUS MANAGEMENT (OPEN / CLOSED) ============
  initStoreStatusListener() {
    this.storeStatus = {
      isOpen: true,
      message: "Store is temporarily closed. We're currently not accepting orders. Please try again later.",
      updatedAt: null
    };

    const doListen = () => {
      if (!window.FirebaseDB || !window.Firestore) return;
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      try {
        fs.onSnapshot(fs.doc(db, 'settings', 'store'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.storeStatus = {
              isOpen: data.isOpen !== false,
              message: data.message || "Store is temporarily closed. We're currently not accepting orders. Please try again later.",
              updatedAt: data.updatedAt || null
            };
            if (data.whatsappNumber) {
              this.setWhatsAppNumber(data.whatsappNumber);
            }
          } else {
            this.storeStatus = {
              isOpen: true,
              message: "Store is temporarily closed. We're currently not accepting orders. Please try again later.",
              updatedAt: null
            };
          }
          this.renderStoreStatusUI();
        }, (err) => {
          console.warn('Store status listener note:', err);
        });
      } catch (e) {
        console.warn('Error attaching store status listener:', e);
      }
    };

    if (window.FirebaseDB && window.Firestore) {
      doListen();
    } else {
      window.addEventListener('firebase-ready', doListen, { once: true });
    }
  },

  renderStoreStatusUI() {
    const isOpen = this.storeStatus ? this.storeStatus.isOpen !== false : true;
    const message = this.storeStatus ? (this.storeStatus.message || "Store is temporarily closed. We're currently not accepting orders. Please try again later.") : "";

    // 1. Sticky Store Closed Banner on Customer Pages
    let banner = document.getElementById('store-closed-sticky-banner');
    const isCustomerPage = !window.location.pathname.includes('/admin/') && !window.location.pathname.includes('/delivery/');

    if (!isOpen && isCustomerPage) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'store-closed-sticky-banner';
        banner.style.cssText = 'background:linear-gradient(135deg, #991b1b, #dc2626);color:#ffffff;padding:12px 20px;text-align:center;font-size:13px;font-weight:600;position:sticky;top:0;z-index:99999;box-shadow:0 3px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;';
        document.body.prepend(banner);
      }
      banner.innerHTML = `
        <span style="font-size:16px;">🔴</span>
        <span><strong>Store Temporarily Closed:</strong> ${this.escapeHtml(message)}</span>
        <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:3px 10px;border-radius:12px;font-weight:bold;">Existing orders are not cancelled &amp; are being delivered</span>
      `;
      banner.style.display = 'flex';
    } else if (banner) {
      banner.style.display = 'none';
    }

    // 2. Disable Place Order and Checkout buttons if closed
    const checkoutBtns = document.querySelectorAll('#btn-checkout, #btn-cart-checkout, #btn-place-order, .btn-place-order, #btn-proceed-checkout, #place-order-btn');
    checkoutBtns.forEach(btn => {
      if (!isOpen) {
        btn.disabled = true;
        btn.setAttribute('data-store-closed', 'true');
        if (!btn.getAttribute('data-original-text')) {
          btn.setAttribute('data-original-text', btn.innerHTML);
        }
        btn.innerHTML = '🔴 Store Closed (Orders Paused)';
        btn.style.opacity = '0.65';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.disabled = false;
        btn.removeAttribute('data-store-closed');
        if (btn.getAttribute('data-original-text')) {
          btn.innerHTML = btn.getAttribute('data-original-text');
        }
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    });

    // 3. Dispatch custom event for page-specific UI components
    window.dispatchEvent(new CustomEvent('store-status-changed', { detail: this.storeStatus }));
  },

  showStoreClosedModal(customMessage) {
    const msg = customMessage || (this.storeStatus ? this.storeStatus.message : "Store is temporarily closed. We're currently not accepting orders. Please try again later.");
    
    let modal = document.getElementById('store-closed-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'store-closed-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal" style="max-width:480px;width:92%;text-align:center;padding:26px;border-radius:16px;">
          <div style="font-size:3rem;margin-bottom:12px;">🏪🔴</div>
          <h3 style="margin:0 0 8px 0;font-size:20px;color:var(--gray-900);">Store Temporarily Closed</h3>
          <p id="store-closed-modal-msg" style="font-size:14px;color:var(--gray-600);line-height:1.6;margin:0 0 16px 0;">${this.escapeHtml(msg)}</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 14px;border-radius:8px;font-size:12px;color:#991b1b;text-align:left;margin-bottom:20px;line-height:1.5;">
            ℹ️ <strong>Existing Orders Active:</strong> All existing orders already accepted are being processed and delivered normally. Only new orders are temporarily paused.
          </div>
          <button class="btn btn-primary w-full" onclick="document.getElementById('store-closed-modal').classList.add('hidden')" style="background:#00695c;padding:10px 0;font-weight:bold;">
            Understood
          </button>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      const msgEl = document.getElementById('store-closed-modal-msg');
      if (msgEl) msgEl.textContent = msg;
      modal.classList.remove('hidden');
    }
  },

  // ============ ORDER RULES (MINIMUM ORDER AMOUNT) ============
  orderRules: {
    minimumOrderAmount: 0,
    minimumOrderEnabled: false,
    updatedAt: null,
    updatedBy: null
  },

  getOrderRules() {
    if (!this.orderRules || typeof this.orderRules.minimumOrderAmount === 'undefined' || this.orderRules.minimumOrderAmount === 0) {
      try {
        const saved = localStorage.getItem('mathura_order_rules');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.orderRules = {
            minimumOrderAmount: Number(parsed.minimumOrderAmount) || 0,
            minimumOrderEnabled: parsed.minimumOrderEnabled === true,
            updatedAt: parsed.updatedAt || null,
            updatedBy: parsed.updatedBy || null
          };
        }
      } catch (e) {}
    }
    return this.orderRules || { minimumOrderAmount: 0, minimumOrderEnabled: false };
  },

  setOrderRules(rules) {
    const minAmt = Number(rules.minimumOrderAmount);
    this.orderRules = {
      minimumOrderAmount: isNaN(minAmt) ? 0 : Math.max(0, minAmt),
      minimumOrderEnabled: rules.minimumOrderEnabled === true,
      updatedAt: rules.updatedAt || new Date().toISOString(),
      updatedBy: rules.updatedBy || null
    };
    try {
      localStorage.setItem('mathura_order_rules', JSON.stringify(this.orderRules));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('order-rules-changed', { detail: this.orderRules }));
    return this.orderRules;
  },

  checkMinimumOrder(subtotal) {
    const rules = this.getOrderRules();
    const minAmount = Number(rules.minimumOrderAmount) || 0;
    const enabled = rules.minimumOrderEnabled === true && minAmount > 0;
    const currentSubtotal = Math.max(0, Number(subtotal) || 0);
    const isMet = !enabled || currentSubtotal >= minAmount;
    const difference = isMet ? 0 : Math.round(minAmount - currentSubtotal);
    const message = isMet
      ? ''
      : `Minimum order amount is ₹${minAmount}. Add ₹${difference} more to place your order.`;

    return {
      isMet,
      enabled,
      minAmount,
      subtotal: currentSubtotal,
      difference,
      message
    };
  },

  initOrderRulesListener() {
    this.getOrderRules(); // Pre-load from localStorage cache

    const doListen = () => {
      if (!window.FirebaseDB || !window.Firestore) return;
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      try {
        fs.onSnapshot(fs.doc(db, 'settings', 'orderRules'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.setOrderRules({
              minimumOrderAmount: data.minimumOrderAmount,
              minimumOrderEnabled: data.minimumOrderEnabled,
              updatedAt: data.updatedAt,
              updatedBy: data.updatedBy
            });
          } else {
            // Check fallback settings/store if orderRules doc doesn't exist yet
            fs.getDoc(fs.doc(db, 'settings', 'store')).then((storeSnap) => {
              if (storeSnap.exists() && typeof storeSnap.data().minimumOrderAmount !== 'undefined') {
                const sData = storeSnap.data();
                this.setOrderRules({
                  minimumOrderAmount: sData.minimumOrderAmount,
                  minimumOrderEnabled: sData.minimumOrderEnabled,
                  updatedAt: sData.updatedAt,
                  updatedBy: sData.updatedBy
                });
              }
            }).catch(() => {});
          }
        }, (err) => {
          console.warn('Order rules listener note:', err);
        });
      } catch (e) {
        console.warn('Error attaching order rules listener:', e);
      }
    };

    if (window.FirebaseDB && window.Firestore) {
      doListen();
    } else {
      window.addEventListener('firebase-ready', doListen, { once: true });
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};

// ============ MOCK API ============
const API = {
  // Sample product data
  products: [
    { id: 1, name: 'Fresh Organic Apples', category: 'Fruits & Vegetables', price: 149, originalPrice: 199, image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', weight: '1 kg', rating: 4.5, reviews: 234, discount: 25, badge: 'Organic', stock: 50, featured: true, bestSeller: true, isNew: false },
    { id: 2, name: 'Whole Milk (Amul)', category: 'Dairy & Eggs', price: 68, originalPrice: 72, image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', weight: '1 litre', rating: 4.8, reviews: 1024, discount: 6, badge: 'Fresh', stock: 120, featured: true, bestSeller: true, isNew: false },
    { id: 3, name: 'Brown Bread (Britannia)', category: 'Bakery', price: 45, originalPrice: 48, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', weight: '400 g', rating: 4.3, reviews: 567, discount: 6, badge: null, stock: 80, featured: false, bestSeller: true, isNew: false },
    { id: 4, name: 'Basmati Rice (India Gate)', category: 'Grains & Cereals', price: 299, originalPrice: 340, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', weight: '5 kg', rating: 4.7, reviews: 892, discount: 12, badge: 'Premium', stock: 45, featured: true, bestSeller: true, isNew: false },
    { id: 5, name: 'Fresh Tomatoes', category: 'Fruits & Vegetables', price: 40, originalPrice: 55, image: 'https://images.unsplash.com/photo-1546470427-e26264be0b0e?w=400', weight: '1 kg', rating: 4.2, reviews: 145, discount: 27, badge: 'Fresh', stock: 200, featured: false, bestSeller: false, isNew: true },
    { id: 6, name: 'Greek Yogurt (Epigamia)', category: 'Dairy & Eggs', price: 85, originalPrice: 99, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400', weight: '400 g', rating: 4.6, reviews: 312, discount: 14, badge: 'New', stock: 60, featured: true, bestSeller: false, isNew: true },
    { id: 7, name: 'Extra Virgin Olive Oil', category: 'Cooking Essentials', price: 699, originalPrice: 850, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', weight: '500 ml', rating: 4.9, reviews: 456, discount: 18, badge: 'Premium', stock: 30, featured: true, bestSeller: false, isNew: false },
    { id: 8, name: 'Free Range Eggs (Dozen)', category: 'Dairy & Eggs', price: 120, originalPrice: 144, image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400', weight: '12 pcs', rating: 4.4, reviews: 678, discount: 17, badge: 'Farm Fresh', stock: 90, featured: false, bestSeller: true, isNew: false },
    { id: 9, name: 'Aloe Vera Shampoo', category: 'Personal Care', price: 199, originalPrice: 250, image: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=400', weight: '300 ml', rating: 4.1, reviews: 234, discount: 20, badge: 'Natural', stock: 75, featured: false, bestSeller: false, isNew: true },
    { id: 10, name: 'Dark Chocolate (Lindt)', category: 'Snacks & Beverages', price: 350, originalPrice: 390, image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400', weight: '100 g', rating: 4.8, reviews: 1234, discount: 10, badge: 'Imported', stock: 55, featured: true, bestSeller: true, isNew: false },
    { id: 11, name: 'Baby Spinach', category: 'Fruits & Vegetables', price: 55, originalPrice: 70, image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400', weight: '250 g', rating: 4.5, reviews: 189, discount: 21, badge: 'Organic', stock: 40, featured: false, bestSeller: false, isNew: true },
    { id: 12, name: 'Chia Seeds', category: 'Health & Wellness', price: 450, originalPrice: 550, image: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=400', weight: '500 g', rating: 4.7, reviews: 345, discount: 18, badge: 'Superfood', stock: 25, featured: true, bestSeller: false, isNew: false },
    { id: 13, name: 'Orange Juice (Tropicana)', category: 'Snacks & Beverages', price: 99, originalPrice: 120, image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400', weight: '1 litre', rating: 4.3, reviews: 567, discount: 18, badge: null, stock: 100, featured: false, bestSeller: true, isNew: false },
    { id: 14, name: 'Whole Wheat Pasta', category: 'Grains & Cereals', price: 180, originalPrice: 220, image: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400', weight: '500 g', rating: 4.4, reviews: 234, discount: 18, badge: 'Healthy', stock: 65, featured: false, bestSeller: false, isNew: true },
    { id: 15, name: 'Honey (Dabur)', category: 'Cooking Essentials', price: 299, originalPrice: 350, image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400', weight: '500 g', rating: 4.6, reviews: 789, discount: 15, badge: 'Pure', stock: 80, featured: true, bestSeller: true, isNew: false },
    { id: 16, name: 'Green Tea (Lipton)', category: 'Snacks & Beverages', price: 180, originalPrice: 210, image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', weight: '25 bags', rating: 4.5, reviews: 923, discount: 14, badge: null, stock: 110, featured: false, bestSeller: true, isNew: false },
  ],

  categories: [
    { id: 1, name: 'Fruits & Vegetables', icon: '🥦', count: 124, color: '#22c55e' },
    { id: 2, name: 'Dairy & Eggs', icon: '🥛', count: 87, color: '#f59e0b' },
    { id: 3, name: 'Bakery', icon: '🍞', count: 56, color: '#f97316' },
    { id: 4, name: 'Grains & Cereals', icon: '🌾', count: 98, color: '#eab308' },
    { id: 5, name: 'Snacks & Beverages', icon: '🧃', count: 145, color: '#ef4444' },
    { id: 6, name: 'Cooking Essentials', icon: '🧄', count: 76, color: '#8b5cf6' },
    { id: 7, name: 'Personal Care', icon: '🧴', count: 89, color: '#ec4899' },
    { id: 8, name: 'Health & Wellness', icon: '💊', count: 67, color: '#06b6d4' },
    { id: 9, name: 'Frozen Foods', icon: '🧊', count: 45, color: '#3b82f6' },
    { id: 10, name: 'Household', icon: '🧹', count: 112, color: '#6366f1' },
  ],

  brands: [
    { id: 'amul',       name: 'Amul',       logo: '🥛', description: 'India\'s largest dairy brand', isActive: true, displayOrder: 1, createdAt: new Date().toISOString() },
    { id: 'britannia',  name: 'Britannia',  logo: '🍪', description: 'Biscuits, bread & dairy', isActive: true, displayOrder: 2, createdAt: new Date().toISOString() },
    { id: 'india-gate', name: 'India Gate', logo: '🌾', description: 'Premium basmati rice',      isActive: true, displayOrder: 3, createdAt: new Date().toISOString() },
    { id: 'nestle',     name: 'Nestlé',     logo: '🍫', description: 'Chocolates & nutrition',   isActive: true, displayOrder: 4, createdAt: new Date().toISOString() },
    { id: 'tropicana',  name: 'Tropicana',  logo: '🧃', description: 'Fresh fruit juices',        isActive: true, displayOrder: 5, createdAt: new Date().toISOString() },
    { id: 'dabur',      name: 'Dabur',      logo: '🫒', description: 'Natural health & care',    isActive: true, displayOrder: 6, createdAt: new Date().toISOString() },
    { id: 'lipton',     name: 'Lipton',     logo: '☕', description: 'Quality teas & beverages',  isActive: true, displayOrder: 7, createdAt: new Date().toISOString() },
    { id: 'lindt',      name: 'Lindt',      logo: '🍫', description: 'Swiss premium chocolate',   isActive: true, displayOrder: 8, createdAt: new Date().toISOString() },
    { id: 'patanjali',  name: 'Patanjali',  logo: '🌿', description: 'Ayurvedic & natural',      isActive: true, displayOrder: 9, createdAt: new Date().toISOString() },
    { id: 'fortune',    name: 'Fortune',    logo: '🧴', description: 'Edible oils & staples',     isActive: true, displayOrder: 10, createdAt: new Date().toISOString() },
  ],

  banners: [
    {
      id: 'banner_farm_fresh',
      title: 'Farm-Fresh Harvest Delivered Daily',
      description: 'Handpicked organic fruits and crisp vegetables directly from local orchards to your doorstep in 60 minutes.',
      desktopImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80',
      mobileImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      badge: '🌿 Farm Fresh Pick',
      discountText: 'Flat 25% OFF',
      couponCode: 'FRESH25',
      buttonText: 'Shop Fresh Produce',
      buttonUrl: '/customer/products.html?category=Fruits+%26+Vegetables',
      displayOrder: 1,
      isActive: true,
      startDate: '2024-01-01T00:00',
      endDate: '2030-12-31T23:59',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'banner_dairy_bakery',
      title: 'Morning Dairy & Bakery Essentials',
      description: 'Start your morning with fresh cow milk, farm eggs, golden butter, and freshly baked artisanal bread.',
      desktopImage: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1400&q=80',
      mobileImage: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80',
      badge: '🥛 Morning Express',
      discountText: 'Special Combo Deals',
      couponCode: 'DAIRY50',
      buttonText: 'Explore Dairy & Bakery',
      buttonUrl: '/customer/products.html?category=Dairy+%26+Eggs',
      displayOrder: 2,
      isActive: true,
      startDate: '2024-01-01T00:00',
      endDate: '2030-12-31T23:59',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'banner_pantry_staples',
      title: 'Super Pantry & Cooking Staples',
      description: 'Premium basmati rice, cold-pressed cooking oils, authentic spices, and pulses at unbeatable everyday prices.',
      desktopImage: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=1400&q=80',
      mobileImage: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=800&q=80',
      badge: '🔥 Wholesale Savings',
      discountText: 'Save up to ₹200',
      couponCode: 'SAVE20',
      buttonText: 'Shop Pantry Staples',
      buttonUrl: '/customer/products.html?category=Cooking+Essentials',
      displayOrder: 3,
      isActive: true,
      startDate: '2024-01-01T00:00',
      endDate: '2030-12-31T23:59',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'banner_snacks_drinks',
      title: 'Snacks, Refreshing Drinks & Treats',
      description: 'Satisfy evening cravings with artisanal teas, fresh fruit juices, gourmet cookies, and family treat packs.',
      desktopImage: 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1400&q=80',
      mobileImage: 'https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=800&q=80',
      badge: '✨ Quick Bites & Sips',
      discountText: 'Buy 2 Get 1 Free',
      couponCode: 'MART100',
      buttonText: 'Order Snacks Now',
      buttonUrl: '/customer/products.html?category=Snacks+%26+Beverages',
      displayOrder: 4,
      isActive: true,
      startDate: '2024-01-01T00:00',
      endDate: '2030-12-31T23:59',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    }
  ],

  coupons: [
    { code: 'FRESH10', discount: 10, type: 'percent', minOrder: 200, description: '10% off on all orders' },
    { code: 'NEWUSER50', discount: 50, type: 'flat', minOrder: 299, description: '₹50 off for new users' },
    { code: 'SAVE20', discount: 20, type: 'percent', minOrder: 500, description: '20% off on orders above ₹500' },
    { code: 'MART100', discount: 100, type: 'flat', minOrder: 999, description: '₹100 off on orders above ₹999' },
  ],

  orders: [],

  reviews: [],

  // Search products (name, category, weight, brand, badge, description)
  searchProducts(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    return this.products.filter(p =>
      (p.name        && p.name.toLowerCase().includes(q))        ||
      (p.category    && p.category.toLowerCase().includes(q))    ||
      (p.weight      && p.weight.toLowerCase().includes(q))      ||
      (p.brandName   && p.brandName.toLowerCase().includes(q))   ||
      (p.brand       && p.brand.toLowerCase().includes(q))       ||
      (p.badge       && p.badge.toLowerCase().includes(q))       ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  },

  // Get products by filter
  getProducts(filter = {}) {
    let products = [...this.products];

    // Hide out-of-stock products for customers (unless explicitly included)
    if (!filter.includeOutOfStock) {
      products = products.filter(p => p.stock === undefined || p.stock === null || p.stock > 0);
    }

    if (filter.category) products = products.filter(p => p.category === filter.category);
    if (filter.brand) {
      const brandQ = String(filter.brand).toLowerCase();
      products = products.filter(p =>
        (p.brandId   && String(p.brandId).toLowerCase()   === brandQ) ||
        (p.brandName && String(p.brandName).toLowerCase().includes(brandQ)) ||
        (p.brand     && String(p.brand).toLowerCase().includes(brandQ))
      );
    }
    if (filter.featured) products = products.filter(p => p.featured);
    if (filter.bestSeller) products = products.filter(p => p.bestSeller);
    if (filter.isNew) products = products.filter(p => p.isNew);
    if (filter.query) {
      const q = filter.query.toLowerCase();
      products = products.filter(p =>
        (p.name        && p.name.toLowerCase().includes(q))        ||
        (p.category    && p.category.toLowerCase().includes(q))    ||
        (p.weight      && p.weight.toLowerCase().includes(q))      ||
        (p.brandName   && p.brandName.toLowerCase().includes(q))   ||
        (p.brand       && p.brand.toLowerCase().includes(q))       ||
        (p.badge       && p.badge.toLowerCase().includes(q))
      );
    }
    if (filter.minPrice) products = products.filter(p => p.price >= filter.minPrice);
    if (filter.maxPrice) products = products.filter(p => p.price <= filter.maxPrice);
    if (filter.sort === 'price-asc')  products.sort((a,b) => a.price - b.price);
    if (filter.sort === 'price-desc') products.sort((a,b) => b.price - a.price);
    if (filter.sort === 'rating')     products.sort((a,b) => b.rating - a.rating);
    if (filter.sort === 'discount')   products.sort((a,b) => b.discount - a.discount);
    return products;
  },

  getProduct(id) {
    return this.products.find(p => String(p.id) === String(id) || p.id === parseInt(id));
  },

  // Validate coupon
  validateCoupon(code, orderTotal) {
    const coupon = this.coupons.find(c => c.code === code.toUpperCase());
    if (!coupon) return { valid: false, message: 'Invalid coupon code' };
    if (orderTotal < coupon.minOrder) return { valid: false, message: `Minimum order ₹${coupon.minOrder} required` };
    const discount = coupon.type === 'percent' ? (orderTotal * coupon.discount / 100) : coupon.discount;
    return { valid: true, coupon, discount, message: coupon.description };
  },

  // Place order
  async placeOrder(orderData) {
    // ── STRICT STORE STATUS VERIFICATION BEFORE ORDER CREATION ──
    if (window.FirebaseDB && window.Firestore) {
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      try {
        const storeDoc = await fs.getDoc(fs.doc(db, 'settings', 'store'));
        if (storeDoc.exists()) {
          const sData = storeDoc.data();
          if (sData.isOpen === false) {
            const closedMsg = sData.message || "Store is temporarily closed. We're currently not accepting orders. Please try again later.";
            MathuraQuickMart.showStoreClosedModal(closedMsg);
            throw new Error(`STORE_CLOSED: ${closedMsg}`);
          }
        }
      } catch (err) {
        if (err.message && err.message.startsWith('STORE_CLOSED:')) {
          throw err;
        }
      }
    } else if (MathuraQuickMart.storeStatus && MathuraQuickMart.storeStatus.isOpen === false) {
      const closedMsg = MathuraQuickMart.storeStatus.message || "Store is temporarily closed. We're currently not accepting orders. Please try again later.";
      MathuraQuickMart.showStoreClosedModal(closedMsg);
      throw new Error(`STORE_CLOSED: ${closedMsg}`);
    }

    // ── STRICT MINIMUM ORDER AMOUNT VERIFICATION ──
    let trustedSubtotal = 0;
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      trustedSubtotal = orderData.items.reduce((sum, item) => {
        const prod = (this.products || []).find(p => String(p.id) === String(item.id) || p.name === item.name);
        const price = (prod && typeof prod.price === 'number') ? prod.price : (Number(item.price) || 0);
        const qty = Math.max(1, parseInt(item.qty, 10) || 1);
        return sum + (price * qty);
      }, 0);
    } else {
      trustedSubtotal = Math.max(0, Number(orderData.subtotal) || 0);
    }

    let minOrderAmount = 0;
    let minOrderEnabled = false;

    if (window.FirebaseDB && window.Firestore) {
      try {
        const fs = window.Firestore;
        const db = window.FirebaseDB;
        const rulesDoc = await fs.getDoc(fs.doc(db, 'settings', 'orderRules'));
        if (rulesDoc.exists()) {
          const rData = rulesDoc.data();
          minOrderAmount = Number(rData.minimumOrderAmount) || 0;
          minOrderEnabled = rData.minimumOrderEnabled === true;
        } else {
          const storeDoc = await fs.getDoc(fs.doc(db, 'settings', 'store'));
          if (storeDoc.exists()) {
            const sData = storeDoc.data();
            minOrderAmount = Number(sData.minimumOrderAmount) || 0;
            minOrderEnabled = sData.minimumOrderEnabled === true;
          }
        }
      } catch (err) {
        console.warn('Could not re-fetch order rules from Firestore, checking local cache:', err);
        const cached = MathuraQuickMart.getOrderRules();
        minOrderAmount = Number(cached.minimumOrderAmount) || 0;
        minOrderEnabled = cached.minimumOrderEnabled === true;
      }
    } else {
      const cached = MathuraQuickMart.getOrderRules();
      minOrderAmount = Number(cached.minimumOrderAmount) || 0;
      minOrderEnabled = cached.minimumOrderEnabled === true;
    }

    if (minOrderEnabled && minOrderAmount > 0 && trustedSubtotal < minOrderAmount) {
      const diff = Math.round(minOrderAmount - trustedSubtotal);
      const errMsg = `Minimum order amount is ₹${minOrderAmount}. Add ₹${diff} more to place your order.`;
      throw new Error(`MINIMUM_ORDER_NOT_MET: ${errMsg}`);
    }

    const nowMs = Date.now();
    const clientOrderId = 'SM' + nowMs;

    // ── Trusted Backend Path: Callable Cloud Function ──
    if (window.FirebaseFunctions && window.FirebaseFunctionsFns) {
      const { httpsCallable } = window.FirebaseFunctionsFns;
      const verifyAndPlace = httpsCallable(window.FirebaseFunctions, 'verifyAndPlaceOrder');

      try {
        const result = await verifyAndPlace({
          items: (orderData.items || []).map(i => ({
            id: i.id,
            qty: i.qty || 1,
            name: i.name
          })),
          address: orderData.address || '',
          customerLocation: orderData.customerLocation || null,
          paymentMethod: orderData.paymentMethod || 'COD',
          couponCode: orderData.couponCode || null,
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          clientOrderId: clientOrderId
        });

        if (result && result.data && result.data.order) {
          const serverOrder = result.data.order;

          // Update local memory and cached state
          const idx = this.orders.findIndex(o => o.id === serverOrder.id);
          if (idx >= 0) {
            this.orders[idx] = serverOrder;
          } else {
            this.orders.unshift(serverOrder);
          }
          const stateIdx = MathuraQuickMart.state.orders.findIndex(o => o.id === serverOrder.id);
          if (stateIdx >= 0) {
            MathuraQuickMart.state.orders[stateIdx] = serverOrder;
          } else {
            MathuraQuickMart.state.orders.unshift(serverOrder);
          }
          MathuraQuickMart.saveState();

          // Queue WhatsApp Order Message (non-blocking)
          try {
            if (typeof WhatsAppService !== 'undefined') {
              WhatsAppService.queueOrderMessage(serverOrder, 'ORDER_PLACED').catch(e => console.warn('WhatsApp queue err:', e));
            }
          } catch (waErr) { console.warn(waErr); }

          // Local In-Memory Stock Decrement for immediate UI feedback
          (serverOrder.items || []).forEach(item => {
            const prod = this.products.find(p => String(p.id) === String(item.id) || p.name === item.name);
            if (prod && typeof prod.stock === 'number') {
              prod.stock = Math.max(0, prod.stock - (item.qty || 1));
            }
          });

          return serverOrder;
        }
      } catch (fnError) {
        console.error("Backend verifyAndPlaceOrder error:", fnError);
        const errMsg = fnError.message || (fnError.details ? String(fnError.details) : 'Server order placement failed.');
        throw new Error(errMsg);
      }
    }

    // Fail closed: Do not silently fallback to insecure client order creation
    throw new Error("Secure order service unavailable. Please check your connection to Firebase Services.");
  },

  // Save/Update order in local state and Firestore
  async saveOrder(order, triggerWhatsApp = false) {
    // Update memory array
    const idx = this.orders.findIndex(o => o.id === order.id);
    if (idx >= 0) {
      this.orders[idx] = order;
    } else {
      this.orders.unshift(order);
    }

    // Update local state
    const stateIdx = MathuraQuickMart.state.orders.findIndex(o => o.id === order.id);
    if (stateIdx >= 0) {
      MathuraQuickMart.state.orders[stateIdx] = order;
    } else {
      MathuraQuickMart.state.orders.unshift(order);
    }
    MathuraQuickMart.saveState();

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'orders', order.id), order);
        console.log(`Order ${order.id} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving order to Firestore:", error);
      }
    }

    if (triggerWhatsApp && typeof WhatsAppService !== 'undefined') {
      WhatsAppService.queueOrderMessage(order).catch(e => console.warn('WhatsApp queue err:', e));
    }
  },

  // Admin stats — dynamically calculated from verified underlying records
  getAdminStats() {
    const orders = this.orders || [];
    const products = this.products || [];
    const totalSales = orders.reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
    const lowStock = products.filter(p => typeof p.stock === 'number' && p.stock <= 10);

    // Compute sales by month for the last 6 months
    const now = new Date();
    const salesChart = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short' });
      const yearMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const monthSales = orders
        .filter(o => {
          const dateStr = o.date || o.createdAt || '';
          return typeof dateStr === 'string' && dateStr.startsWith(yearMonth);
        })
        .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);
      salesChart.push({ month: monthLabel, sales: monthSales });
    }

    return {
      totalSales,
      totalOrders: orders.length,
      totalCustomers: new Set(orders.map(o => o.userId || o.customerPhone || o.customerEmail).filter(Boolean)).size,
      totalProducts: products.length,
      revenue: {
        today: orders
          .filter(o => (o.date || o.createdAt || '').startsWith(now.toISOString().split('T')[0]))
          .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0),
        total: totalSales
      },
      recentOrders: [...orders].sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)).slice(0, 5),
      lowStock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, category: p.category })),
      salesChart
    };
  },

  // Delivery orders — reads live orders from API.orders (synced from Firestore)
  getDeliveryOrders(staffId) {
    const activeStatuses = ['assigned', 'confirmed', 'processing', 'packed', 'out-delivery'];
    const liveOrders = (this.orders || []).filter(o => activeStatuses.includes(o.status));

    // Map live orders to the shape the delivery dashboard expects
    if (liveOrders.length > 0) {
      return liveOrders.map(o => ({
        id: o.id,
        customer: o.customerName || o.customer || 'Customer',
        phone: o.customerPhone || o.phone || 'N/A',
        address: o.address || 'N/A',
        items: Array.isArray(o.items) ? o.items.length : (o.items || 0),
        total: o.subtotal || o.total || 0,
        status: o.status,
        lat: o.customerLocation?.latitude || o.lat || 9.3639,
        lng: o.customerLocation?.longitude || o.lng || 78.8395,
        assignedAt: o.date || o.createdAt || new Date().toISOString(),
      }));
    }

    // Honest empty state when no active live orders exist
    return [];
  },

  // Database Synchronization Methods — PARALLEL fetch for speed
  async syncFromFirestore() {
    if (!window.FirebaseDB || !window.Firestore) {
      console.warn("Firestore not available yet.");
      return;
    }
    const db = window.FirebaseDB;
    const { collection, getDocs, query, where } = window.Firestore;

    console.log("🔄 Starting Firestore sync (parallel)...");
    const t0 = performance.now();

    const currentUser = MathuraQuickMart.state?.user;

    // Secure order querying: admin gets all orders; delivery gets assigned orders; customer gets their own orders; guests get none.
    let ordersPromise = Promise.resolve(null);
    if (currentUser && currentUser.role === 'admin') {
      ordersPromise = getDocs(collection(db, 'orders')).catch(e => { console.warn("orders sync (admin):", e.message); return null; });
    } else if (currentUser && currentUser.role === 'delivery' && currentUser.uid) {
      ordersPromise = getDocs(query(collection(db, 'orders'), where('driverId', '==', currentUser.uid))).catch(e => { console.warn("orders sync (delivery):", e.message); return null; });
    } else if (currentUser && currentUser.uid) {
      ordersPromise = getDocs(query(collection(db, 'orders'), where('userId', '==', currentUser.uid))).catch(e => { console.warn("orders sync (user):", e.message); return null; });
    }

    // Fire ALL reads in parallel — single network round-trip
    const [productsSnap, categoriesSnap, couponsSnap, ordersSnap, reviewsSnap, brandsSnap, bannersSnap] =
      await Promise.all([
        getDocs(collection(db, 'products')).catch(e => { console.warn("products sync:", e.message); return null; }),
        getDocs(collection(db, 'categories')).catch(e => { console.warn("categories sync:", e.message); return null; }),
        getDocs(collection(db, 'coupons')).catch(e => { console.warn("coupons sync:", e.message); return null; }),
        ordersPromise,
        getDocs(collection(db, 'reviews')).catch(e => { console.warn("reviews sync:", e.message); return null; }),
        getDocs(collection(db, 'brands')).catch(e => { console.warn("brands sync:", e.message); return null; }),
        getDocs(query(collection(db, 'banners'), where('isActive', '==', true))).catch(e => { console.warn("banners sync:", e.message); return null; }),
      ]);

    // Process results with deduplication
    if (productsSnap && !productsSnap.empty) {
      const prodMap = new Map();
      productsSnap.forEach(doc => {
        const p = doc.data();
        p.id = parseInt(p.id) || p.id;
        const key = String(p.id);
        if (!prodMap.has(key)) prodMap.set(key, p);
      });
      this.products = Array.from(prodMap.values());
      console.log(`Synced ${this.products.length} products.`);
    }

    if (categoriesSnap && !categoriesSnap.empty) {
      const catMap = new Map();
      categoriesSnap.forEach(doc => {
        const c = doc.data();
        const key = String(c.id || c.name);
        if (!catMap.has(key)) catMap.set(key, c);
      });
      this.categories = Array.from(catMap.values());
      console.log(`Synced ${this.categories.length} categories.`);
    }

    if (couponsSnap && !couponsSnap.empty) {
      const coupMap = new Map();
      couponsSnap.forEach(doc => {
        const c = doc.data();
        const key = String(c.code || '').toUpperCase();
        if (key && !coupMap.has(key)) coupMap.set(key, c);
      });
      this.coupons = Array.from(coupMap.values());
      console.log(`Synced ${this.coupons.length} coupons.`);
    }

    if (ordersSnap && !ordersSnap.empty) {
      const ordMap = new Map();
      ordersSnap.forEach(doc => {
        const o = { id: doc.id, ...doc.data() };
        if (!o || !o.id) return;
        const key = String(o.id).trim();
        if (!ordMap.has(key)) ordMap.set(key, o);
      });
      const ords = Array.from(ordMap.values());
      ords.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
      this.orders = ords;

      if (currentUser && currentUser.uid) {
        MathuraQuickMart.state.orders = ords;
        MathuraQuickMart.saveState();
      }
      console.log(`Synced ${ords.length} orders.`);
    }

    if (reviewsSnap && !reviewsSnap.empty) {
      const revMap = new Map();
      reviewsSnap.forEach(doc => {
        const r = doc.data();
        const key = String(r.id || (r.productId + '_' + (r.user || '')));
        if (!revMap.has(key)) revMap.set(key, r);
      });
      this.reviews = Array.from(revMap.values());
      console.log(`Synced ${this.reviews.length} reviews.`);
    }

    if (brandsSnap && !brandsSnap.empty) {
      const brandMap = new Map();
      brandsSnap.forEach(doc => {
        const b = doc.data();
        const key = String(b.id || b.name);
        if (!brandMap.has(key)) brandMap.set(key, b);
      });
      const sorted = Array.from(brandMap.values()).sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
      this.brands = sorted;
      console.log(`Synced ${this.brands.length} brands.`);
    }

    if (bannersSnap && !bannersSnap.empty) {
      const bannerMap = new Map();
      bannersSnap.forEach(doc => {
        const b = { id: doc.id, ...doc.data() };
        if (!b || !b.id) return;
        bannerMap.set(String(b.id), b);
      });
      const sortedBanners = Array.from(bannerMap.values()).sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));
      this.banners = sortedBanners;
      console.log(`Synced ${this.banners.length} banners.`);
    }

    console.log(`🔄 Data sync complete in ${Math.round(performance.now() - t0)}ms`);
    window.dbReady = true;
    window.dispatchEvent(new CustomEvent('db-ready'));
  },


  async addReview(review) {
    this.reviews.unshift(review);
    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'reviews', review.id.toString()), review);
        console.log(`Review ${review.id} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving review to Firestore:", error);
      }
    }
  },

  async saveProduct(product) {
    const idx = this.products.findIndex(p => String(p.id) === String(product.id));
    if (idx >= 0) {
      this.products[idx] = product;
    } else {
      this.products.push(product);
    }

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'products', product.id.toString()), product);
        console.log(`Product ${product.id} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving product to Firestore:", error);
      }
    }
  },

  async deleteProduct(productId) {
    this.products = this.products.filter(p => String(p.id) !== String(productId));

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, deleteDoc } = window.Firestore;
      try {
        await deleteDoc(doc(db, 'products', productId.toString()));
        console.log(`Product ${productId} deleted from Firestore.`);
      } catch (error) {
        console.error("Error deleting product from Firestore:", error);
      }
    }
  },

  async saveCategory(category) {
    const idx = this.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      this.categories[idx] = category;
    } else {
      this.categories.push(category);
    }

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'categories', category.name), category);
        console.log(`Category ${category.name} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving category to Firestore:", error);
      }
    }
  },

  async deleteCategory(catName) {
    this.categories = this.categories.filter(c => c.name !== catName);

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, deleteDoc } = window.Firestore;
      try {
        await deleteDoc(doc(db, 'categories', catName));
        console.log(`Category ${catName} deleted from Firestore.`);
      } catch (error) {
        console.error("Error deleting category from Firestore:", error);
      }
    }
  },

  async saveCoupon(coupon) {
    const idx = this.coupons.findIndex(c => c.code === coupon.code);
    if (idx >= 0) {
      this.coupons[idx] = coupon;
    } else {
      this.coupons.push(coupon);
    }

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'coupons', coupon.code), coupon);
        console.log(`Coupon ${coupon.code} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving coupon to Firestore:", error);
        throw error;
      }
    }
  },

  async deleteCoupon(code) {
    this.coupons = this.coupons.filter(c => c.code !== code);

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, deleteDoc } = window.Firestore;
      try {
        await deleteDoc(doc(db, 'coupons', code));
        console.log(`Coupon ${code} deleted from Firestore.`);
      } catch (error) {
        console.error("Error deleting coupon from Firestore:", error);
      }
    }
  },

  async saveBrand(brand) {
    const idx = this.brands.findIndex(b => b.id === brand.id);
    if (idx >= 0) {
      this.brands[idx] = brand;
    } else {
      this.brands.push(brand);
    }
    this.brands.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'brands', brand.id), brand);
        console.log(`Brand ${brand.id} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving brand to Firestore:", error);
        throw error;
      }
    }
  },

  async deleteBrand(brandId) {
    this.brands = this.brands.filter(b => b.id !== brandId);

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, deleteDoc } = window.Firestore;
      try {
        await deleteDoc(doc(db, 'brands', brandId));
        console.log(`Brand ${brandId} deleted from Firestore.`);
      } catch (error) {
        console.error("Error deleting brand from Firestore:", error);
      }
    }
  },

  // ---- Promotional Banners Methods ----
  getBanners(options = {}) {
    let list = [...(this.banners || [])];
    const onlyActive = options.onlyActive !== false;

    if (onlyActive) {
      const now = Date.now();
      list = list.filter(b => {
        if (b.isActive === false) return false;
        if (b.startDate) {
          const start = new Date(b.startDate).getTime();
          if (!isNaN(start) && start > now) return false;
        }
        if (b.endDate) {
          const end = new Date(b.endDate).getTime();
          if (!isNaN(end) && end < now) return false;
        }
        return true;
      });
    }

    list.sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));
    return list;
  },

  async saveBanner(banner) {
    if (!banner.id) {
      banner.id = 'banner_' + Date.now();
    }
    banner.updatedAt = new Date().toISOString();
    if (!banner.createdAt) banner.createdAt = banner.updatedAt;
    banner.displayOrder = Number(banner.displayOrder) || 1;
    banner.isActive = banner.isActive !== false;

    if (!this.banners) this.banners = [];
    const idx = this.banners.findIndex(b => b.id === banner.id);
    if (idx >= 0) {
      this.banners[idx] = { ...this.banners[idx], ...banner };
    } else {
      this.banners.push(banner);
    }
    this.banners.sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'banners', banner.id), banner, { merge: true });
        console.log(`Banner ${banner.id} saved to Firestore.`);
      } catch (error) {
        console.error("Error saving banner to Firestore:", error);
        throw error;
      }
    }
    return banner;
  },

  async deleteBanner(bannerId) {
    this.banners = (this.banners || []).filter(b => b.id !== bannerId);

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, deleteDoc } = window.Firestore;
      try {
        await deleteDoc(doc(db, 'banners', bannerId));
        console.log(`Banner ${bannerId} deleted from Firestore.`);
      } catch (error) {
        console.error("Error deleting banner from Firestore:", error);
        throw error;
      }
    }
  },

  async reorderBanners(orderedIds) {
    if (!Array.isArray(orderedIds)) return;
    if (!this.banners) this.banners = [];

    const updates = [];
    orderedIds.forEach((id, index) => {
      const order = index + 1;
      const b = this.banners.find(item => item.id === id);
      if (b) {
        b.displayOrder = order;
        b.updatedAt = new Date().toISOString();
        if (window.FirebaseDB && window.Firestore) {
          const db = window.FirebaseDB;
          const { doc, setDoc } = window.Firestore;
          updates.push(
            setDoc(doc(db, 'banners', id), { displayOrder: order, updatedAt: b.updatedAt }, { merge: true })
          );
        }
      }
    });

    this.banners.sort((a, b) => (Number(a.displayOrder) || 99) - (Number(b.displayOrder) || 99));

    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        console.log("Banners reordered in Firestore.");
      } catch (error) {
        console.error("Error updating banner order in Firestore:", error);
        throw error;
      }
    }
  },
};

// Expose MathuraQuickMart and API to window globally
window.MathuraQuickMart = MathuraQuickMart;
window.API = API;

// ============ PRODUCT CARD & CART BUTTON RENDERER ============
function renderCartButtonHtml(productId, stock) {
  const pId = String(productId);
  const cartItem = MathuraQuickMart.getCart().find(i => String(i.id) === pId);
  const cartQty = cartItem ? (cartItem.qty || 0) : 0;

  if (stock !== undefined && stock !== null && Number(stock) <= 0) {
    return `<button class="add-to-cart-btn" disabled style="opacity:0.5;font-size:10px;">OUT OF STOCK</button>`;
  }
  if (cartQty > 0) {
    return `
      <div class="qty-counter" onclick="event.stopPropagation();">
        <button onclick="event.stopPropagation(); updateCartQtyDirect('${pId}', ${cartQty - 1})" aria-label="Decrease quantity">-</button>
        <span>${cartQty}</span>
        <button onclick="event.stopPropagation(); addToCart('${pId}')" aria-label="Increase quantity">+</button>
      </div>`;
  }
  return `
    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${pId}')" aria-label="Add to cart">
      ADD
    </button>`;
}

function updateProductCardButtons(targetProductId = null) {
  const selector = (targetProductId != null && targetProductId !== '')
    ? `.product-card-btn-container[data-btn-product-id="${targetProductId}"]`
    : `.product-card-btn-container[data-btn-product-id]`;

  const containers = document.querySelectorAll(selector);
  containers.forEach(container => {
    const pid = container.getAttribute('data-btn-product-id');
    if (!pid) return;
    const product = (window.API && window.API.getProduct)
      ? window.API.getProduct(pid)
      : (window.API && window.API.products ? window.API.products.find(p => String(p.id) === String(pid)) : null);
    const stock = product ? product.stock : 999;
    container.innerHTML = renderCartButtonHtml(pid, stock);
  });
}

function renderProductCard(product, options = {}) {
  const pId = String(product.id);
  const inWishlist = MathuraQuickMart.isInWishlist(product.id);
  const discountPercent = product.discount || (product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);
  const cartButtonHtml = renderCartButtonHtml(pId, product.stock);

  return `
    <div class="product-card" data-product-id="${pId}" onclick="window.location.href='/customer/product-detail.html?id=${pId}'">
      <div class="product-card-img" style="position:relative;overflow:hidden;">
        ${discountPercent ? `<div class="discount-pill">${discountPercent}% OFF</div>` : ''}
        <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=400'">
        <button class="product-card-wishlist ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist('${pId}')" title="Wishlist">
          ${inWishlist ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="product-card-body" style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:4px;">
          <span class="eta-tag">⚡ 10 MINS</span>
          <span style="font-size:11px;font-weight:700;color:var(--primary-dark);">★ ${product.rating || '4.8'}</span>
        </div>
        <div class="product-card-name" title="${product.name}">${product.name}</div>
        <div class="product-card-weight">${product.weight || '500g'}</div>
        <div class="product-card-footer" style="margin-top:auto;">
          <div class="product-card-price" style="margin-bottom:0;">
            <span class="price-current">₹${product.price}</span>
            ${product.originalPrice ? `<span class="price-original">₹${product.originalPrice}</span>` : ''}
          </div>
          <div class="product-card-btn-container" data-btn-product-id="${pId}" style="min-width:76px;">
            ${cartButtonHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="${i <= Math.floor(rating) ? '' : i <= rating + 0.5 ? '' : 'star-empty'}">★</span>`;
  }
  return stars;
}

function addToCart(productId) {
  const product = (window.API && window.API.getProduct)
    ? window.API.getProduct(productId)
    : (window.API && window.API.products ? window.API.products.find(p => String(p.id) === String(productId)) : null);
  if (product) {
    MathuraQuickMart.addToCart(product);
    refreshProductCards(productId);
  }
}

function updateCartQtyDirect(productId, qty) {
  MathuraQuickMart.updateCartQty(productId, qty);
  refreshProductCards(productId);
}

function refreshProductCards(productId = null) {
  updateProductCardButtons(productId);
  if (typeof renderStorefront === 'function') renderStorefront();
  if (typeof renderProducts === 'function') renderProducts();
}

window.renderCartButtonHtml = renderCartButtonHtml;
window.updateProductCardButtons = updateProductCardButtons;

// Keep cards synchronized when cart changes or across tabs
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('cart-updated', () => {
    updateProductCardButtons();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'mathuraquickmart_state') {
      MathuraQuickMart.loadState();
      MathuraQuickMart.renderCartBadge();
      updateProductCardButtons();
    }
  });
}

function toggleWishlist(productId) {
  const product = API.getProduct(productId);
  if (!product) return;
  const isNow = MathuraQuickMart.toggleWishlist(product);
  // Update button
  const btns = document.querySelectorAll(`.product-card-wishlist[onclick*="${productId}"]`);
  btns.forEach(btn => {
    btn.textContent = isNow ? '❤️' : '🤍';
    btn.classList.toggle('active', isNow);
  });
}

// ============ CATEGORY GRID RENDERER ============
function renderCategories(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = API.categories.map(cat => {
    // Count actual products belonging to this category (case-insensitive match)
    const realCount = API.products.filter(p =>
      p.category && p.category.toLowerCase() === cat.name.toLowerCase()
    ).length;
    return `
    <div class="category-card" onclick="window.location.href='/customer/products.html?category=${encodeURIComponent(cat.name)}'">
      <span class="category-icon">${cat.icon}</span>
      <div class="category-name">${cat.name}</div>
      <div class="category-count">${realCount} item${realCount !== 1 ? 's' : ''}</div>
    </div>
  `;
  }).join('');
}

// ============ DROPDOWN TOGGLE ============
function toggleDropdown(id) {
  const menu = document.getElementById(id);
  if (!menu) return;
  const isVisible = menu.style.display === 'block';
  document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
  menu.style.display = isVisible ? 'none' : 'block';
}

// ============ WHATSAPP MESSAGE SERVICE (ZERO API - CLICK-TO-CHAT ONLY) ============
const WhatsAppService = {
  // Default message templates
  DEFAULT_TEMPLATES: {
    ORDER_PLACED: "🛒 *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} has been received successfully.\n\n*Order Total:* ₹{total}\n\nThank you for shopping with Mathura QuickMart!",
    ORDER_CONFIRMED: "✅ *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} has been confirmed.\n\n*Order Total:* ₹{total}\n\nWe are preparing your order now.\n\nThank you!",
    PROCESSING: "📦 *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} is being prepared and packed.\n\n*Order Total:* ₹{total}\n\nThank you for your patience!",
    READY: "🛍️ *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} is ready and waiting for delivery partner pickup.\n\nThank you for choosing Mathura QuickMart!",
    OUT_FOR_DELIVERY: "🛵 *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} is now out for delivery.\n\nOur delivery partner is on the way.\n\nThank you for shopping with us!",
    DELIVERED: "✅ *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} has been delivered successfully.\n\nThank you for shopping with us! 🙏",
    CANCELLED: "❌ *Mathura QuickMart*\n\nHello {customerName},\n\nYour order #{orderId} has been cancelled.\n\nIf you have any questions, please contact us.",
    SPECIAL_OFFER: "Hello {customerName} 👋\n\n🔥 *Weekend Special at Mathura QuickMart!*\n\nGet {discount} on orders above ₹{minOrder}.\n\nUse coupon code: *{couponCode}*\n\nValid until: {expiryDate}\n\nShop now and save! 🛒",
    CUSTOM_MESSAGE: "Hello {customerName} 👋\n\n{customText}\n\nBest regards,\n*Mathura QuickMart*"
  },

  // Map order status string to template key
  mapStatusToMessageType(status) {
    if (!status) return 'ORDER_PLACED';
    const s = String(status).toLowerCase().replace(/[-_]/g, '');
    if (s.includes('placed')) return 'ORDER_PLACED';
    if (s.includes('confirm')) return 'ORDER_CONFIRMED';
    if (s.includes('process')) return 'PROCESSING';
    if (s.includes('ready') || s.includes('pack')) return 'READY';
    if (s.includes('out') || s.includes('delivery')) return 'OUT_FOR_DELIVERY';
    if (s.includes('deliver')) return 'DELIVERED';
    if (s.includes('cancel')) return 'CANCELLED';
    return 'ORDER_CONFIRMED';
  },

  // Format and validate phone numbers for WhatsApp click-to-chat
  formatPhone(phone) {
    if (!phone) return { isValid: false, formattedPhone: '', rawPhone: '', displayPhone: 'No phone' };
    const raw = String(phone).trim();
    // Strip all non-digit characters
    let digits = raw.replace(/\D/g, '');
    
    // Auto-handle 10-digit Indian standard mobile numbers
    if (digits.length === 10) {
      digits = '91' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = '91' + digits.substring(1);
    }
    
    const isValid = digits.length >= 10 && digits.length <= 15;
    const displayPhone = isValid
      ? (digits.startsWith('91') && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`)
      : raw;

    return {
      isValid,
      formattedPhone: digits,
      rawPhone: raw,
      displayPhone
    };
  },

  // Fill message template placeholders
  fillTemplate(template, vars = {}) {
    if (!template) return '';
    let res = template;
    const allVars = {
      customerName: vars.customerName || vars.customer || 'Valued Customer',
      orderId: vars.orderId || vars.id || 'N/A',
      total: vars.total !== undefined ? vars.total : (vars.subtotal || 0),
      couponCode: vars.couponCode || 'SPECIAL',
      expiryDate: vars.expiryDate || 'Limited Period',
      discount: vars.discount ? (typeof vars.discount === 'number' ? `${vars.discount}% OFF` : vars.discount) : 'Special Discount',
      minOrder: vars.minOrder || 299,
      deliveryAddress: vars.deliveryAddress || vars.address || 'your address',
      shopName: 'Mathura QuickMart',
      customText: vars.customText || '',
      ...vars
    };

    Object.keys(allVars).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      res = res.replace(regex, allVars[key]);
    });
    return res;
  },

  // Generate official wa.me link
  getClickToChatUrl(phone, messageText) {
    const { formattedPhone, isValid } = this.formatPhone(phone);
    if (!isValid || !formattedPhone) return null;
    const encoded = encodeURIComponent(messageText || '');
    return `https://wa.me/${formattedPhone}?text=${encoded}`;
  },

  // Queue order WhatsApp message in Firestore with deduplication key
  async queueOrderMessage(order, statusOverride = null) {
    if (!order || !order.id) return null;
    const status = statusOverride || order.status || 'placed';
    const messageType = this.mapStatusToMessageType(status);
    const messageId = `msg_${order.id}_${messageType}`;

    const phoneData = this.formatPhone(order.customerPhone || order.phone);
    const customerName = order.customerName || order.customer || 'Valued Customer';
    
    // Check custom template in local cache or fallback default
    const customTemplates = window.WhatsAppCustomTemplates || {};
    const rawTemplate = customTemplates[messageType] || this.DEFAULT_TEMPLATES[messageType] || this.DEFAULT_TEMPLATES.ORDER_CONFIRMED;

    const messageText = this.fillTemplate(rawTemplate, {
      customerName,
      orderId: order.id,
      total: order.total || order.subtotal || 0,
      deliveryAddress: order.address || 'your registered address'
    });

    const msgPayload = {
      messageId,
      customerId: order.userId || 'guest',
      customerName,
      customerPhone: phoneData.formattedPhone || phoneData.rawPhone || '',
      rawPhone: phoneData.rawPhone || '',
      orderId: order.id,
      campaignId: null,
      messageType,
      message: messageText,
      status: 'pending',
      isValidPhone: phoneData.isValid,
      createdAt: new Date().toISOString(),
      openedAt: null,
      sentAt: null
    };

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const fs = window.Firestore;
      try {
        const existingDoc = await fs.getDoc(fs.doc(db, 'whatsappMessages', messageId));
        if (existingDoc.exists()) {
          console.log(`ℹ️ WhatsApp message ${messageId} exists with status: ${existingDoc.data().status}`);
          return existingDoc.data();
        }
        await fs.setDoc(fs.doc(db, 'whatsappMessages', messageId), msgPayload);
        console.log(`📱 WhatsApp order message record created: ${messageId}`);
      } catch (err) {
        console.warn('Could not save WhatsApp message record:', err);
      }
    }

    return msgPayload;
  }
};

window.WhatsAppService = WhatsAppService;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  MathuraQuickMart.init();
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('PWA service worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('PWA service worker registration failed:', error);
      });
  });
}
