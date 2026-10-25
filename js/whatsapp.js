/**
 * Mathura QuickMart — WhatsApp Message Generator & Launcher Controller
 * Pure Click-to-Chat (wa.me) Implementation — No API / Meta Cloud API Required
 */

'use strict';

const WhatsAppAdmin = {
  // State
  campaigns: [],
  customers: [],
  orders: [],
  selectedTarget: 'all',
  activeTab: 'campaigns',
  bannerUrl: null,

  // Initialize
  async init() {
    this.bindEvents();
    this.loadStoreSettings();
    this.initRealtimeListeners();
    this.updateCampaignPreview();
  },

  // Load WhatsApp Store Settings
  loadStoreSettings() {
    const num = (typeof MathuraQuickMart !== 'undefined') ? MathuraQuickMart.getWhatsAppNumber() : '919876543210';
    const input = document.getElementById('store-whatsapp-num-input');
    if (input) input.value = num;
    this.updateConfigBadge(num);
  },

  updateConfigBadge(num) {
    const badge = document.getElementById('wa-config-status-badge');
    if (!badge) return;
    const clean = (typeof MathuraQuickMart !== 'undefined') ? MathuraQuickMart.cleanPhoneNumber(num) : num;
    if (clean && clean.length >= 10) {
      badge.className = 'badge badge-green';
      badge.textContent = '🟢 Store Number Configured';
    } else {
      badge.className = 'badge badge-red';
      badge.textContent = '🔴 Number Required';
    }
  },

  async saveStoreNumber() {
    const input = document.getElementById('store-whatsapp-num-input');
    if (!input) return;
    const raw = input.value.trim();
    const cleaned = MathuraQuickMart.cleanPhoneNumber(raw);
    if (!cleaned || cleaned.length < 10) {
      MathuraQuickMart.toast('Please enter a valid mobile number with country code (e.g. 919876543210)', 'error');
      return;
    }

    MathuraQuickMart.setWhatsAppNumber(cleaned);
    input.value = cleaned;
    this.updateConfigBadge(cleaned);

    // Save to Firestore settings/store
    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const { doc, setDoc } = window.Firestore;
      try {
        await setDoc(doc(db, 'settings', 'store'), {
          whatsappNumber: cleaned,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not persist WhatsApp number to Firestore:', e);
      }
    }

    MathuraQuickMart.toast('✅ Store WhatsApp number saved successfully!', 'success');
  },

  // Real-time Firestore Listeners
  initRealtimeListeners() {
    if (!window.FirebaseDB || !window.Firestore) {
      setTimeout(() => this.initRealtimeListeners(), 800);
      return;
    }

    const db = window.FirebaseDB;
    const fs = window.Firestore;

    // Listen for Campaigns History
    try {
      fs.onSnapshot(fs.collection(db, 'whatsappCampaigns'), (snapshot) => {
        const camps = [];
        snapshot.forEach(doc => camps.push({ id: doc.id, ...doc.data() }));
        this.campaigns = camps.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        this.renderCampaignHistory();
      }, (err) => {
        console.warn('Campaigns listener note:', err);
      });
    } catch (e) {
      console.warn('Error starting campaigns listener:', e);
    }

    // Listen for Customers & Orders
    try {
      fs.onSnapshot(fs.collection(db, 'users'), (snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          if (d.role !== 'admin' && d.role !== 'delivery') {
            list.push({ id: doc.id, ...d });
          }
        });
        this.customers = list;
        this.updateAudienceMetrics();
      }, (err) => {
        console.warn('Users listener note:', err);
      });
    } catch (e) {}

    try {
      fs.onSnapshot(fs.collection(db, 'orders'), (snapshot) => {
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        this.orders = list;
        this.updateAudienceMetrics();
      }, (err) => {
        console.warn('Orders listener note:', err);
      });
    } catch (e) {}
  },

  // Tab Switcher
  switchTab(tabKey) {
    this.activeTab = tabKey;
    document.querySelectorAll('.wa-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
    document.querySelectorAll('.wa-tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `wa-panel-${tabKey}`);
    });
  },

  // Dynamic Campaign Message Generator
  generateCampaignMessage() {
    const title = (document.getElementById('camp-title')?.value || 'Grocery Offer').trim();
    const coupon = (document.getElementById('camp-coupon')?.value || '').trim().toUpperCase();
    const discount = (document.getElementById('camp-discount')?.value || '').trim();
    const minOrder = (document.getElementById('camp-min-order')?.value || '').trim();
    const expiry = (document.getElementById('camp-expiry')?.value || '').trim();
    const customNote = (document.getElementById('camp-custom-note')?.value || '').trim();

    let msg = `Hello 👋\n\n🔥 *${title}!*`;
    
    if (discount) {
      msg += `\n\nGet *${discount}* on your grocery order.`;
    }
    
    if (coupon) msg += `\n\n🎟 *Coupon:* ${coupon}`;
    if (minOrder) msg += `\n🛒 *Minimum Order:* ₹${minOrder}`;
    if (expiry) msg += `\n⏰ *Valid Until:* ${expiry}`;
    if (customNote) msg += `\n\n${customNote}`;

    msg += `\n\nShop now at *Mathura Quick Mart*.\n\nThank you! 🛒`;
    return msg;
  },

  // Update Live Phone Message Preview
  updateCampaignPreview() {
    const previewEl = document.getElementById('wa-preview-text');
    if (!previewEl) return;

    const msg = this.generateCampaignMessage();
    const formatted = msg.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    
    previewEl.innerHTML = formatted;

    const bannerImg = document.getElementById('camp-banner-img');
    const placeholderText = document.getElementById('banner-placeholder-text');

    if (this.bannerUrl && bannerImg) {
      bannerImg.src = this.bannerUrl;
      bannerImg.style.display = 'block';
      if (placeholderText) placeholderText.style.display = 'none';
    } else if (bannerImg) {
      bannerImg.style.display = 'none';
      if (placeholderText) placeholderText.style.display = 'block';
    }
  },

  // Handle Banner Upload
  handleBannerUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      MathuraQuickMart.toast('⚠️ Banner image size must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.bannerUrl = e.target.result;
      this.updateCampaignPreview();
      MathuraQuickMart.toast('🖼️ Offer banner uploaded to preview!', 'success');
    };
    reader.readAsDataURL(file);
  },

  // Open WhatsApp for Store Campaign
  openCampaignWhatsApp() {
    const msg = this.generateCampaignMessage();
    MathuraQuickMart.openWhatsApp(msg);
    this.saveCampaignRecord(msg, 'Opened');
    MathuraQuickMart.toast('💬 Opening WhatsApp with pre-filled campaign message...', 'success');
  },

  // Save Campaign Record to Firestore
  async saveCampaignRecord(messageText, status = 'Ready') {
    const title = (document.getElementById('camp-title')?.value || 'General Offer').trim();
    const coupon = (document.getElementById('camp-coupon')?.value || '').trim().toUpperCase();
    const discount = (document.getElementById('camp-discount')?.value || '').trim();
    const target = this.selectedTarget;

    const eligibleCount = this.getFilteredCustomers().length;

    const payload = {
      title,
      coupon,
      discount,
      message: messageText,
      targetAudience: target,
      eligibleCustomers: eligibleCount,
      status: status, // 'Draft', 'Ready', 'Opened', 'Completed Manually'
      createdAt: new Date().toISOString()
    };

    if (window.FirebaseDB && window.Firestore) {
      const db = window.FirebaseDB;
      const fs = window.Firestore;
      try {
        await fs.addDoc(fs.collection(db, 'whatsappCampaigns'), payload);
      } catch (e) {
        console.warn('Could not save campaign record:', e);
      }
    }
  },

  // Audience Filtering Logic
  selectAudience(target) {
    this.selectedTarget = target;
    document.querySelectorAll('.audience-radio-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-target') === target);
    });
    this.updateAudienceMetrics();
  },

  getFilteredCustomers() {
    const list = this.customers || [];
    const orders = this.orders || [];

    if (this.selectedTarget === 'all') return list;

    if (this.selectedTarget === 'recent') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentUserIds = new Set(orders.filter(o => (o.date || o.createdAt || '') >= thirtyDaysAgo).map(o => o.userId || o.customerPhone || o.phone));
      return list.filter(c => recentUserIds.has(c.id) || recentUserIds.has(c.phone));
    }

    if (this.selectedTarget === 'inactive') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const activeUserIds = new Set(orders.filter(o => (o.date || o.createdAt || '') >= thirtyDaysAgo).map(o => o.userId || o.customerPhone || o.phone));
      return list.filter(c => !activeUserIds.has(c.id) && !activeUserIds.has(c.phone));
    }

    if (this.selectedTarget === 'high_value') {
      const userSpentMap = new Map();
      orders.forEach(o => {
        const key = o.userId || o.customerPhone || o.phone || 'guest';
        const current = userSpentMap.get(key) || 0;
        userSpentMap.set(key, current + (o.total || o.subtotal || 0));
      });
      return list.filter(c => (userSpentMap.get(c.id) || userSpentMap.get(c.phone) || 0) >= 1000);
    }

    return list;
  },

  updateAudienceMetrics() {
    const filtered = this.getFilteredCustomers();
    const countEl = document.getElementById('audience-eligible-count');
    if (countEl) countEl.textContent = filtered.length;

    this.renderAudienceCustomerList(filtered);
  },

  renderAudienceCustomerList(customerList) {
    const container = document.getElementById('audience-customer-list');
    if (!container) return;

    if (!customerList || customerList.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--gray-500);font-size:13px;">No customers match the selected audience filter.</div>`;
      return;
    }

    container.innerHTML = customerList.slice(0, 50).map(c => {
      const name = c.name || c.displayName || 'Customer';
      const phone = c.phone || c.phoneNumber || '919876543210';
      const safePhone = MathuraQuickMart.cleanPhoneNumber(phone);
      const safeName = name.replace(/'/g, "\\'");

      return `
        <div class="card-flat p-3 flex justify-between items-center" style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;margin-bottom:8px;">
          <div>
            <strong style="font-size:13px;display:block;color:var(--gray-900);">${name}</strong>
            <span style="font-size:11px;color:var(--gray-500);">📞 ${phone}</span>
          </div>
          <button class="btn btn-whatsapp btn-sm" onclick="WhatsAppAdmin.openIndividualCustomerWhatsApp('${safePhone}', '${safeName}')">
            💬 Open WhatsApp
          </button>
        </div>
      `;
    }).join('');
  },

  openIndividualCustomerWhatsApp(phone, name) {
    const custName = name || 'Valued Customer';
    const baseMsg = this.generateCampaignMessage();
    const personalizedMsg = `Hello ${custName} 👋\n\n` + baseMsg;
    MathuraQuickMart.openWhatsApp(personalizedMsg, phone);
    MathuraQuickMart.toast(`💬 WhatsApp opened for ${custName}!`, 'success');
  },

  renderCampaignHistory() {
    const tbody = document.getElementById('campaign-history-tbody');
    if (!tbody) return;

    if (!this.campaigns || this.campaigns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">No campaigns generated yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.campaigns.map(c => `
      <tr>
        <td><strong>${c.title || 'Untitled Offer'}</strong></td>
        <td><span class="badge badge-green">${c.coupon || 'N/A'}</span></td>
        <td>${c.discount || 'Special Discount'}</td>
        <td><span class="badge badge-outline">${c.targetAudience || 'All'}</span> (${c.eligibleCustomers || 0} eligible)</td>
        <td><span class="badge ${c.status === 'Opened' ? 'badge-green' : 'badge-blue'}">${c.status || 'Ready'}</span></td>
        <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
      </tr>
    `).join('');
  },

  bindEvents() {
    const inputs = ['camp-title', 'camp-coupon', 'camp-discount', 'camp-min-order', 'camp-expiry', 'camp-custom-note'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateCampaignPreview());
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  WhatsAppAdmin.init();
});

window.WhatsAppAdmin = WhatsAppAdmin;
