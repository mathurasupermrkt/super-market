/**
 * Mathura Quick Mart - Shared Application Engine
 * State management, cart, wishlist, auth, toast notifications
 */

'use strict';

// ============ STATE MANAGEMENT ============
const MathuraQuickMart = {
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

  // Save state to localStorage
  saveState() {
    try {
      localStorage.setItem('mathuraquickmart_state', JSON.stringify(this.state));
    } catch(e) { console.warn('State save error:', e); }
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
  getCart() { return this.state.cart; },

  getCartCount() {
    return this.state.cart.reduce((sum, item) => sum + item.qty, 0);
  },

  getCartTotal() {
    return this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  },

  addToCart(product, qty = 1) {
    const prodId = String(product.id);
    const existing = this.state.cart.find(i => String(i.id) === prodId);
    if (existing) {
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
  toast(message, type = 'success', duration = 3500) {
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

        // 3. Load this user's orders (filtered by userId)
        try {
          const ordersQuery = fs.query(
            fs.collection(db, 'orders'),
            fs.where('userId', '==', uid)
          );
          const ordersSnap = await fs.getDocs(ordersQuery);
          if (!ordersSnap.empty) {
            const orderMap = new Map();
            ordersSnap.forEach(d => {
              const order = d.data();
              if (!order || !order.id) return;
              const key = String(order.id);
              if (!orderMap.has(key)) {
                orderMap.set(key, order);
              }
            });
            const orders = Array.from(orderMap.values());
            orders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
            this.state.orders = orders;
            this.saveState();
          }
        } catch (e) { console.warn('Orders query failed (index may be needed):', e); }

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

  coupons: [
    { code: 'FRESH10', discount: 10, type: 'percent', minOrder: 200, description: '10% off on all orders' },
    { code: 'NEWUSER50', discount: 50, type: 'flat', minOrder: 299, description: '₹50 off for new users' },
    { code: 'SAVE20', discount: 20, type: 'percent', minOrder: 500, description: '20% off on orders above ₹500' },
    { code: 'MART100', discount: 100, type: 'flat', minOrder: 999, description: '₹100 off on orders above ₹999' },
  ],

  orders: [
    { id: 'SM2024001', date: '2024-12-20', status: 'delivered', total: 458, items: 4, tracking: 'Delivered on Dec 22' },
    { id: 'SM2024002', date: '2024-12-22', status: 'out-delivery', total: 892, items: 7, tracking: 'Out for delivery' },
    { id: 'SM2024003', date: '2024-12-23', status: 'processing', total: 234, items: 2, tracking: 'Being processed' },
  ],

  reviews: [
    { id: 1, productId: 1, user: 'Priya S.', rating: 5, date: '2024-12-15', comment: 'Absolutely fresh and delicious! The apples are crispy and sweet. Will definitely order again.', verified: true },
    { id: 2, productId: 1, user: 'Rahul M.', rating: 4, date: '2024-12-10', comment: 'Good quality apples. Delivered on time. Slightly expensive but worth it for organic.', verified: true },
    { id: 3, productId: 1, user: 'Anita K.', rating: 5, date: '2024-12-08', comment: 'Best apples I have ever had from an online store. Packaging was excellent.', verified: false },
  ],

  // Search products
  searchProducts(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    return this.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
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
    if (filter.featured) products = products.filter(p => p.featured);
    if (filter.bestSeller) products = products.filter(p => p.bestSeller);
    if (filter.isNew) products = products.filter(p => p.isNew);
    if (filter.query) {
      const q = filter.query.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
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
    return this.products.find(p => p.id === parseInt(id));
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

    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();
    const expiresISO = new Date(nowMs + 30 * 1000).toISOString(); // 30s timeout

    const order = {
      id: 'SM' + nowMs,
      ...orderData,
      total: (orderData.subtotal || 0) + (orderData.deliveryFee || 0) - (orderData.discount || 0),
      status: 'confirmed',
      driverId: null,
      driverName: null,
      deliveryRequestStatus: 'pending',
      deliveryRequestCreatedAt: nowISO,
      deliveryRequestExpiresAt: expiresISO,
      declinedDrivers: [],
      assignmentType: 'automatic',
      date: nowISO,
      createdAt: nowISO,
      estimatedDelivery: new Date(nowMs + 2 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Save order (local state + Firestore)
    await this.saveOrder(order);

    // ── Queue WhatsApp Order Message (Non-blocking, deduplicated) ──
    try {
      if (typeof WhatsAppService !== 'undefined') {
        WhatsAppService.queueOrderMessage(order, 'ORDER_PLACED').catch(e => console.warn('WhatsApp queue err:', e));
      }
    } catch (waErr) { console.warn(waErr); }

    // ── Automatic Stock Decrement (Parallel & Non-Blocking) ──
    if (window.FirebaseDB && window.Firestore && order.items && order.items.length > 0) {
      const fs = window.Firestore;
      const db = window.FirebaseDB;
      
      Promise.all((order.items || []).map(async (item) => {
        try {
          const productId = String(item.id);
          const docRef = fs.doc(db, 'products', productId);
          const docSnap = await fs.getDoc(docRef);

          if (docSnap.exists()) {
            const currentStock = docSnap.data().stock || 0;
            const newStock = Math.max(0, currentStock - (item.qty || 1));
            await fs.updateDoc(docRef, { stock: newStock });
            console.log(`📦 Stock updated: ${item.name} → ${newStock} units remaining`);
          } else {
            const q = fs.query(fs.collection(db, 'products'), fs.where('name', '==', item.name));
            const snap = await fs.getDocs(q);
            if (!snap.empty) {
              const matchDoc = snap.docs[0];
              const currentStock = matchDoc.data().stock || 0;
              const newStock = Math.max(0, currentStock - (item.qty || 1));
              await fs.updateDoc(matchDoc.ref, { stock: newStock });
              console.log(`📦 Stock updated (by name): ${item.name} → ${newStock} units remaining`);
            }
          }
        } catch (e) {
          console.error(`Error updating stock for ${item.name}:`, e);
        }
      })).catch(err => console.error('Background stock decrement error:', err));
    }

    return order;
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

  // Admin stats
  getAdminStats() {
    return {
      totalSales: 2847593,
      totalOrders: 12847,
      totalCustomers: 8934,
      totalProducts: 1247,
      revenue: {
        today: 45890,
        week: 312450,
        month: 1289340,
        year: 12847593,
      },
      recentOrders: [
        { id: 'SM240001', customer: 'Priya Sharma', items: 4, total: 458, status: 'delivered', date: '2024-12-23' },
        { id: 'SM240002', customer: 'Rahul Mehta', items: 7, total: 892, status: 'out-delivery', date: '2024-12-23' },
        { id: 'SM240003', customer: 'Anita Kumar', items: 2, total: 234, status: 'processing', date: '2024-12-22' },
        { id: 'SM240004', customer: 'Vikram Singh', items: 5, total: 676, status: 'confirmed', date: '2024-12-22' },
        { id: 'SM240005', customer: 'Meera Nair', items: 3, total: 389, status: 'pending', date: '2024-12-21' },
      ],
      lowStock: [
        { id: 7, name: 'Extra Virgin Olive Oil', stock: 5, category: 'Cooking Essentials' },
        { id: 12, name: 'Chia Seeds', stock: 8, category: 'Health & Wellness' },
        { id: 15, name: 'Honey (Dabur)', stock: 12, category: 'Cooking Essentials' },
      ],
      salesChart: [
        { month: 'Jul', sales: 890000 },
        { month: 'Aug', sales: 1020000 },
        { month: 'Sep', sales: 940000 },
        { month: 'Oct', sales: 1180000 },
        { month: 'Nov', sales: 1340000 },
        { month: 'Dec', sales: 1289340 },
      ],
    };
  },

  // Delivery orders — reads live orders from API.orders (synced from Firestore)
  getDeliveryOrders(staffId) {
    const activeStatuses = ['confirmed', 'processing', 'packed', 'out-delivery'];
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
        lat: o.lat || 13.0850,
        lng: o.lng || 80.0178,
        assignedAt: o.date || new Date().toISOString(),
      }));
    }

    // Fallback to demo data only if no live orders exist yet
    return [
      { id: 'SM240002', customer: 'Rahul Mehta', phone: '+91 98765 43210', address: '42, Green Park, New Delhi - 110016', items: 7, total: 892, status: 'out-delivery', lat: 28.5562, lng: 77.2100, assignedAt: '2024-12-23T09:00:00Z' },
      { id: 'SM240006', customer: 'Sunita Patel', phone: '+91 87654 32109', address: '8, Rose Garden, Sector 15, Noida - 201301', items: 3, total: 345, status: 'packed', lat: 28.5844, lng: 77.3267, assignedAt: '2024-12-23T10:30:00Z' },
      { id: 'SM240007', customer: 'Arun Joshi', phone: '+91 76543 21098', address: '17, Lake View, Indirapuram - 201014', items: 5, total: 678, status: 'confirmed', lat: 28.6440, lng: 77.3657, assignedAt: '2024-12-23T11:00:00Z' },
    ];
  },

  // Database Synchronization Methods — PARALLEL fetch for speed
  async syncFromFirestore() {
    if (!window.FirebaseDB || !window.Firestore) {
      console.warn("Firestore not available yet.");
      return;
    }
    const db = window.FirebaseDB;
    const { collection, getDocs } = window.Firestore;

    console.log("🔄 Starting Firestore sync (parallel)...");
    const t0 = performance.now();

    // Fire ALL reads in parallel — single network round-trip
    const [productsSnap, categoriesSnap, couponsSnap, ordersSnap, reviewsSnap] =
      await Promise.all([
        getDocs(collection(db, 'products')).catch(e => { console.warn("products sync:", e.message); return null; }),
        getDocs(collection(db, 'categories')).catch(e => { console.warn("categories sync:", e.message); return null; }),
        getDocs(collection(db, 'coupons')).catch(e => { console.warn("coupons sync:", e.message); return null; }),
        getDocs(collection(db, 'orders')).catch(e => { console.warn("orders sync:", e.message); return null; }),
        getDocs(collection(db, 'reviews')).catch(e => { console.warn("reviews sync:", e.message); return null; }),
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
        const o = doc.data();
        if (!o || !o.id) return;
        const key = String(o.id);
        if (!ordMap.has(key)) ordMap.set(key, o);
      });
      const ords = Array.from(ordMap.values());
      ords.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      this.orders = ords;
      MathuraQuickMart.state.orders = ords;
      MathuraQuickMart.saveState();
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
    const idx = this.products.findIndex(p => p.id === product.id);
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
    this.products = this.products.filter(p => p.id !== productId);

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
};

// Expose API to window globally
window.API = API;

// ============ PRODUCT CARD RENDERER ============
function renderProductCard(product, options = {}) {
  const inWishlist = MathuraQuickMart.isInWishlist(product.id);
  const cartItem = MathuraQuickMart.getCart().find(i => i.id === product.id);
  const cartQty = cartItem ? cartItem.qty : 0;
  const discountPercent = product.discount || (product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);

  let cartButtonHtml = '';
  if (product.stock <= 0) {
    cartButtonHtml = `<button class="add-to-cart-btn" disabled style="opacity:0.5;font-size:10px;">OUT OF STOCK</button>`;
  } else if (cartQty > 0) {
    cartButtonHtml = `
      <div class="qty-counter" onclick="event.stopPropagation();">
        <button onclick="updateCartQtyDirect(${product.id}, ${cartQty - 1})">-</button>
        <span>${cartQty}</span>
        <button onclick="addToCart(${product.id})">+</button>
      </div>`;
  } else {
    cartButtonHtml = `
      <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id})">
        ADD
      </button>`;
  }

  return `
    <div class="product-card" onclick="window.location.href='/customer/product-detail.html?id=${product.id}'">
      <div class="product-card-img" style="position:relative;overflow:hidden;">
        ${discountPercent ? `<div class="discount-pill">${discountPercent}% OFF</div>` : ''}
        <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=400'">
        <button class="product-card-wishlist ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist(${product.id})" title="Wishlist">
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
          <div style="min-width:76px;">
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
  const product = API.getProduct(productId);
  if (product) {
    MathuraQuickMart.addToCart(product);
    refreshProductCards();
  }
}

function updateCartQtyDirect(productId, qty) {
  MathuraQuickMart.updateCartQty(productId, qty);
  refreshProductCards();
}

function refreshProductCards() {
  if (typeof renderStorefront === 'function') renderStorefront();
  if (typeof renderProducts === 'function') renderProducts();
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

    // ── Automated Serverless Backend Dispatch to Meta WhatsApp Cloud API ──
    try {
      fetch('/api/whatsapp/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          eventType: messageType,
          customerName,
          customerPhone: phoneData.formattedPhone || phoneData.rawPhone,
          total: order.total || order.subtotal || 0,
          driverName: order.driverName || order.assignedDriver || null,
          customerId: order.userId || null
        })
      }).then(res => res.json()).then(data => {
        if (data.success) {
          console.log(`✅ [Meta WhatsApp Cloud API] Notification delivered for order ${order.id} (WAMID: ${data.whatsappMessageId})`);
        } else if (data.skipped) {
          console.log(`ℹ️ [WhatsApp Notification] Skipped: ${data.reason || data.message}`);
        } else {
          console.warn(`⚠️ [WhatsApp Notification] API note: ${data.error || 'Check server logs'}`);
        }
      }).catch(err => {
        console.warn('[WhatsApp Notification Dispatch] Backend API unavailable or offline:', err.message);
      });
    } catch (e) {
      console.warn('Background WhatsApp dispatch error:', e);
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
