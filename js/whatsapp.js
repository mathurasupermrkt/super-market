/**
 * Mathura QuickMart — WhatsApp Business Platform (Cloud API) Admin Controller
 * Manages automated Meta Cloud API campaigns, status receipts, live health checks, and test messages.
 */

const WhatsAppAdmin = {
  // State
  messages: [],
  campaigns: [],
  customers: [],
  orders: [],
  selectedTarget: 'opted_in',
  queueFilter: 'all',
  searchQuery: '',
  activeTab: 'campaigns',
  chartInstance: null,
  bannerBase64: null,
  bannerUrl: null,

  // Initialize
  async init() {
    this.bindEvents();
    this.initRealtimeListeners();
    this.fetchLiveStats();
    this.checkApiStatus();
  },

  // Check Meta Cloud API Connection
  async checkApiStatus() {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();

      const badge = document.getElementById('meta-api-status-badge');
      const pill = document.getElementById('cfg-status-pill');
      const phoneIdEl = document.getElementById('cfg-phone-id');
      const wabaIdEl = document.getElementById('cfg-waba-id');

      if (data.connected) {
        if (badge) {
          badge.className = 'api-badge-connected';
          badge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;"></span> Meta Cloud API Active (${data.displayPhoneNumber || 'Live'})`;
        }
        if (pill) {
          pill.className = 'badge badge-green';
          pill.textContent = '🟢 Connected & Verified';
        }
      } else {
        if (badge) {
          badge.className = 'api-badge-disconnected';
          badge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;"></span> Configuration Required`;
        }
        if (pill) {
          pill.className = 'badge badge-orange';
          pill.textContent = '🟡 Waiting for Vercel Env Vars';
        }
      }

      if (phoneIdEl) phoneIdEl.textContent = data.phoneNumberId || 'Set in Vercel';
      if (wabaIdEl) wabaIdEl.textContent = data.businessAccountId || 'Set in Vercel';

    } catch (e) {
      console.warn('Could not fetch API status:', e.message);
    }
  },

  // Real-time Firestore Listeners
  initRealtimeListeners() {
    if (!window.FirebaseDB || !window.Firestore) {
      setTimeout(() => this.initRealtimeListeners(), 800);
      return;
    }

    const db = window.FirebaseDB;
    const fs = window.Firestore;

    // 1. Listen for WhatsApp Messages & Delivery Statuses
    try {
      fs.onSnapshot(fs.collection(db, 'whatsappMessages'), (snapshot) => {
        const list = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        // Newest first
        this.messages = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        this.renderAll();
      }, (err) => {
        console.warn('Realtime messages listener note:', err);
      });
    } catch (e) {
      console.warn('Error starting messages listener:', e);
    }

    // 2. Listen for Campaigns
    try {
      fs.onSnapshot(fs.collection(db, 'whatsappCampaigns'), (snapshot) => {
        const camps = [];
        snapshot.forEach(doc => camps.push({ id: doc.id, ...doc.data() }));
        this.campaigns = camps.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        this.renderCampaigns();
        this.updateStats();
      }, (err) => {
        console.warn('Realtime campaigns listener note:', err);
      });
    } catch (e) {
      console.warn('Error starting campaigns listener:', e);
    }

    // 3. Load Customers for Audience Target Estimations
    try {
      fs.getDocs(fs.collection(db, 'users')).then(snap => {
        const users = [];
        snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
        this.customers = users.filter(u => u.role === 'customer' || !u.role);
        this.updateCampaignAudienceEstimate();
        this.updateStats();
      });
    } catch (e) {
      console.warn('Could not load users collection:', e);
    }
  },

  // Tab Switcher
  switchTab(tabKey) {
    this.activeTab = tabKey;
    document.querySelectorAll('.wa-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    document.querySelectorAll('.wa-tab-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const targetPanel = document.getElementById(`wa-panel-${tabKey}`);
    if (targetPanel) targetPanel.classList.remove('hidden');

    if (tabKey === 'analytics') {
      setTimeout(() => this.renderAnalyticsChart(), 100);
    }
    if (tabKey === 'history') {
      this.renderHistory();
    }
    if (tabKey === 'settings') {
      this.checkApiStatus();
    }
  },

  // Stats Counters
  updateStats() {
    const totalSent = this.messages.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length;
    const delivered = this.messages.filter(m => m.status === 'delivered' || m.status === 'read').length;
    const read = this.messages.filter(m => m.status === 'read').length;
    const optedIn = this.customers.filter(c => c.whatsappOptIn !== false && (c.marketingMessagesEnabled === true || c.offerMessagesEnabled === true)).length;

    const elSent = document.getElementById('stat-wa-sent');
    const elDelivered = document.getElementById('stat-wa-delivered');
    const elRead = document.getElementById('stat-wa-read');
    const elOpted = document.getElementById('stat-wa-optedin');
    const elCamps = document.getElementById('stat-wa-campaigns');

    if (elSent) elSent.textContent = totalSent;
    if (elDelivered) elDelivered.textContent = delivered;
    if (elRead) elRead.textContent = read;
    if (elOpted) elOpted.textContent = optedIn;
    if (elCamps) elCamps.textContent = this.campaigns.length;

    const badge = document.getElementById('tab-badge-pending');
    if (badge) badge.textContent = this.messages.length;
  },

  // Filter Queue
  setQueueFilter(filter) {
    this.queueFilter = filter;
    document.querySelectorAll('.wa-filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === filter);
    });
    this.renderQueue();
  },

  // Render Queue Cards
  renderQueue() {
    const container = document.getElementById('wa-queue-container');
    if (!container) return;

    let filtered = [...this.messages];

    // Filter by status
    if (this.queueFilter !== 'all') {
      filtered = filtered.filter(m => m.status === this.queueFilter);
    }

    // Filter by search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        (m.customerName && m.customerName.toLowerCase().includes(q)) ||
        (m.customerPhone && m.customerPhone.includes(q)) ||
        (m.orderId && String(m.orderId).toLowerCase().includes(q)) ||
        (m.whatsappMessageId && m.whatsappMessageId.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="wa-empty-state">
          <div class="wa-empty-icon">📭</div>
          <h4 style="margin:0 0 6px 0;font-size:16px;">No messages found</h4>
          <p style="margin:0;font-size:13px;">New order notifications and offer broadcasts will appear here in real time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(msg => {
      const status = msg.status || 'sent';
      const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now';
      const dateStr = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-IN') : '';

      let statusBadge = `<span class="badge badge-blue">🚀 SENT</span>`;
      if (status === 'delivered') statusBadge = `<span class="badge badge-green">📬 DELIVERED</span>`;
      if (status === 'read') statusBadge = `<span class="badge badge-green" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd;">✓✓ READ</span>`;
      if (status === 'failed') statusBadge = `<span class="badge badge-orange" style="background:#fee2e2;color:#b91c1c;border-color:#fca5a5;" title="${msg.errorMessage || 'Failed'}">❌ FAILED</span>`;

      return `
        <div class="wa-queue-card">
          <div class="wa-card-header">
            <div class="flex items-center gap-3">
              <div class="wa-card-avatar">${(msg.customerName || 'C').charAt(0).toUpperCase()}</div>
              <div>
                <strong style="font-size:14px;color:var(--gray-900);display:block;">${this.escapeHtml(msg.customerName || 'Customer')}</strong>
                <span class="wa-card-phone">📞 ${msg.customerPhone || 'N/A'}</span>
              </div>
            </div>
            <div style="text-align:right;">
              ${statusBadge}
              <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">${dateStr} ${timeStr}</div>
            </div>
          </div>

          <div class="wa-card-meta">
            <span>🏷️ <strong>Event:</strong> ${msg.messageType || 'ORDER_UPDATE'}</span>
            ${msg.orderId ? `<span>📦 <strong>Order:</strong> #${msg.orderId}</span>` : ''}
            ${msg.whatsappMessageId ? `<span>⚡ <strong>Meta ID:</strong> <code style="font-size:10px;">${msg.whatsappMessageId.substring(0, 16)}...</code></span>` : ''}
          </div>

          <div class="wa-bubble-preview">
            <div class="wa-chat-bubble" style="font-size:12px;">
              ${this.escapeHtml(msg.message || `Meta Template: ${msg.templateName || 'standard'}`).replace(/\n/g, '<br>')}
              <div class="bubble-time">
                <span>${timeStr}</span>
                <span style="color:${status === 'read' ? 'var(--wa-blue-tick)' : 'var(--gray-400)'};">${status === 'read' || status === 'delivered' ? '✓✓' : '✓'}</span>
              </div>
            </div>
          </div>

          ${msg.errorMessage ? `
            <div style="font-size:11px;color:#b91c1c;background:#fee2e2;padding:6px 10px;border-radius:6px;margin-top:8px;">
              ⚠️ Error: ${this.escapeHtml(msg.errorMessage)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  // Banner Upload Handling
  handleBannerUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      MathuraQuickMart.toast('⚠️ Image must be under 2MB for WhatsApp templates', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.bannerBase64 = e.target.result;
      this.bannerUrl = this.bannerBase64;
      this.updateBannerUI(this.bannerBase64);
    };
    reader.readAsDataURL(file);
  },

  handleBannerUrlInput(url) {
    this.bannerUrl = url.trim() || null;
    this.updateBannerUI(this.bannerUrl);
  },

  updateBannerUI(imgSrc) {
    const imgEl = document.getElementById('camp-banner-img');
    const placeholder = document.getElementById('banner-placeholder-text');
    const mockupWrap = document.getElementById('mockup-banner-wrap');
    const mockupImg = document.getElementById('mockup-banner-img');

    if (imgSrc) {
      if (imgEl) { imgEl.src = imgSrc; imgEl.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
      if (mockupWrap) mockupWrap.style.display = 'block';
      if (mockupImg) mockupImg.src = imgSrc;
    } else {
      if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
      if (placeholder) placeholder.style.display = 'block';
      if (mockupWrap) mockupWrap.style.display = 'none';
    }
  },

  // Set Target Audience
  setCampaignTarget(target) {
    this.selectedTarget = target;
    document.querySelectorAll('.wa-target-card').forEach(card => {
      const match = card.dataset.target === target;
      card.classList.toggle('selected', match);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = match;
    });
    this.updateCampaignAudienceEstimate();
  },

  // Calculate Audience Estimate
  updateCampaignAudienceEstimate() {
    const countEl = document.getElementById('campaign-audience-count');
    if (!countEl) return;

    const list = this.getTargetedRecipients();
    countEl.textContent = `${list.length} customer(s)`;
  },

  getTargetedRecipients() {
    // Filter customers who have opt-in
    let eligible = this.customers.filter(c => c.whatsappOptIn !== false && (c.marketingMessagesEnabled === true || c.offerMessagesEnabled === true));

    // Filter by sub-category
    if (this.selectedTarget === 'recent_30') {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      eligible = eligible.filter(c => c.lastOrderDate && new Date(c.lastOrderDate).getTime() > thirtyDaysAgo);
    } else if (this.selectedTarget === 'inactive_60') {
      const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
      eligible = eligible.filter(c => !c.lastOrderDate || new Date(c.lastOrderDate).getTime() < sixtyDaysAgo);
    } else if (this.selectedTarget === 'high_value') {
      eligible = eligible.filter(c => (c.totalSpent || 0) >= 1000);
    }

    // Ensure they have valid phone numbers
    return eligible.filter(c => {
      const p = String(c.phone || c.whatsappPhone || '').replace(/\D/g, '');
      return p.length >= 10;
    });
  },

  // Live Phone Mockup Updates
  updateCampaignPreview() {
    const title = document.getElementById('camp-title')?.value || 'Weekend Grocery Bonanza';
    const coupon = (document.getElementById('camp-coupon')?.value || 'WEEKEND20').toUpperCase();
    const discount = document.getElementById('camp-discount')?.value || '20% OFF';
    const minOrder = document.getElementById('camp-min-order')?.value || '499';
    const expiry = document.getElementById('camp-expiry')?.value || 'Sunday Midnight';

    const tEl = document.getElementById('mock-title');
    const cEl = document.getElementById('mock-coupon');
    const dEl = document.getElementById('mock-discount');
    const mEl = document.getElementById('mock-min');
    const eEl = document.getElementById('mock-expiry');

    if (tEl) tEl.textContent = title;
    if (cEl) cEl.textContent = coupon;
    if (dEl) dEl.textContent = discount;
    if (mEl) mEl.textContent = minOrder;
    if (eEl) eEl.textContent = expiry;
  },

  // Open Campaign Confirmation Modal
  openCampaignConfirmationModal() {
    const title = document.getElementById('camp-title')?.value.trim();
    const coupon = document.getElementById('camp-coupon')?.value.trim();
    const discount = document.getElementById('camp-discount')?.value.trim();

    if (!title || !coupon || !discount) {
      MathuraQuickMart.toast('Please fill in Offer Title, Coupon Code, and Discount', 'error');
      return;
    }

    const recipients = this.getTargetedRecipients();
    if (recipients.length === 0) {
      MathuraQuickMart.toast('⚠️ No eligible opted-in customers match this target filter', 'error');
      return;
    }

    document.getElementById('confirm-camp-title').textContent = title;
    document.getElementById('confirm-camp-coupon').textContent = coupon.toUpperCase();
    document.getElementById('confirm-camp-discount').textContent = discount;
    document.getElementById('confirm-camp-target').textContent = this.selectedTarget.replace('_', ' ').toUpperCase();
    document.getElementById('confirm-camp-recipients').textContent = `${recipients.length} customers (Opted-in)`;

    document.getElementById('wa-confirm-modal').classList.remove('hidden');
  },

  closeConfirmModal() {
    document.getElementById('wa-confirm-modal').classList.add('hidden');
  },

  // 1-Click Automated Campaign Publishing via Backend Meta Cloud API
  async executeCampaignPublish() {
    const title = document.getElementById('camp-title').value.trim();
    const coupon = document.getElementById('camp-coupon').value.trim().toUpperCase();
    const discount = document.getElementById('camp-discount').value.trim();
    const minOrder = document.getElementById('camp-min-order').value || '499';
    const expiryDate = document.getElementById('camp-expiry').value || 'Sunday Midnight';
    const recipients = this.getTargetedRecipients();

    const btn = document.getElementById('btn-confirm-publish');
    if (btn) { btn.textContent = '🚀 Broadcasting via Meta Cloud API...'; btn.disabled = true; }

    try {
      const payload = {
        title,
        couponCode: coupon,
        discount,
        minOrder,
        expiryDate,
        bannerUrl: this.bannerUrl,
        targetType: this.selectedTarget,
        recipients
      };

      const res = await fetch('/api/whatsapp/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        MathuraQuickMart.toast(`✅ Campaign launched! Sent to ${data.summary?.sent || recipients.length} customers via Meta Cloud API`, 'success');
        this.closeConfirmModal();
        this.switchTab('queue');
      } else {
        MathuraQuickMart.toast(`API Note: ${data.error || 'Check Vercel env vars'}`, 'error');
      }
    } catch (err) {
      console.error('Campaign broadcast error:', err);
      MathuraQuickMart.toast('Network error dispatching campaign', 'error');
    } finally {
      if (btn) { btn.textContent = '🚀 Publish Campaign Now'; btn.disabled = false; }
    }
  },

  // Render Campaigns List
  renderCampaigns() {
    const container = document.getElementById('wa-campaigns-list');
    if (!container) return;

    if (this.campaigns.length === 0) {
      container.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">No campaigns broadcast yet. Create your first promotional blast on the left!</p>';
      return;
    }

    container.innerHTML = this.campaigns.map(c => {
      const timeStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent';
      const statusClass = c.status === 'completed' ? 'badge-green' : (c.status === 'processing' ? 'badge-blue' : 'badge-orange');

      return `
        <div class="card-flat p-4 mb-3" style="border:1px solid var(--gray-200);border-radius:12px;background:var(--white);">
          <div class="flex justify-between items-center mb-2">
            <strong style="color:var(--gray-900);font-size:14px;">${this.escapeHtml(c.title || 'Special Offer')}</strong>
            <span class="badge ${statusClass}">${(c.status || 'SENT').toUpperCase()}</span>
          </div>
          <div style="font-size:12px;color:var(--gray-600);margin-bottom:6px;">
            🎟️ Code: <strong style="color:#075e54;">${c.couponCode || 'PROMO'}</strong> (${c.discount || 'Special'}) • 🎯 Target: ${c.targetType || 'Opted-in'}
          </div>
          <div class="flex justify-between items-center" style="font-size:11px;color:var(--gray-500);border-top:1px dashed var(--gray-200);padding-top:6px;margin-top:6px;">
            <span>👥 Recipients: <strong>${c.recipientCount || c.sentCount || 0}</strong></span>
            <span>📬 Delivered: <strong>${c.deliveredCount || c.sentCount || 0}</strong></span>
            <span>🕒 ${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // Test Modal
  openTestModal() {
    document.getElementById('wa-test-modal').classList.remove('hidden');
  },

  closeTestModal() {
    document.getElementById('wa-test-modal').classList.add('hidden');
  },

  async sendQuickTest() {
    const phone = document.getElementById('quick-test-phone').value.trim();
    const template = document.getElementById('quick-test-template').value;

    if (!phone) {
      MathuraQuickMart.toast('Please enter a phone number', 'error');
      return;
    }

    const btn = document.getElementById('btn-quick-test');
    if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, template })
      });
      const data = await res.json();

      if (data.success) {
        MathuraQuickMart.toast('✅ Live test template dispatched via Meta API!', 'success');
        this.closeTestModal();
      } else {
        MathuraQuickMart.toast(`Test Error: ${data.error || 'Check credentials in Vercel'}`, 'error');
      }
    } catch (e) {
      MathuraQuickMart.toast('Network error sending test message', 'error');
    } finally {
      if (btn) { btn.textContent = 'Send Test'; btn.disabled = false; }
    }
  },

  async sendLiveTestMessage() {
    const phone = document.getElementById('test-phone').value.trim();
    const template = document.getElementById('test-template').value;

    if (!phone) {
      MathuraQuickMart.toast('Please enter a recipient mobile number', 'error');
      return;
    }

    const btn = document.getElementById('btn-send-test');
    if (btn) { btn.textContent = '🚀 Dispatching...'; btn.disabled = true; }

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, template })
      });
      const data = await res.json();

      if (data.success) {
        MathuraQuickMart.toast('✅ Test message successfully sent via Meta WhatsApp Cloud API!', 'success');
      } else {
        MathuraQuickMart.toast(`Meta API Error: ${data.error || 'Check Vercel env vars'}`, 'error');
      }
    } catch (e) {
      MathuraQuickMart.toast('Error connecting to backend test endpoint', 'error');
    } finally {
      if (btn) { btn.textContent = '🚀 Dispatch Test Message via Meta API'; btn.disabled = false; }
    }
  },

  // Render Full Audit History
  renderHistory() {
    const tbody = document.getElementById('wa-history-tbody');
    if (!tbody) return;

    if (this.messages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray-500);">No message logs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.messages.map(msg => {
      const status = msg.status || 'sent';
      const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-IN') : 'N/A';
      const wamid = msg.whatsappMessageId ? msg.whatsappMessageId.substring(0, 16) + '...' : 'Simulated';

      let statusBadge = `<span class="badge badge-blue">SENT</span>`;
      if (status === 'delivered') statusBadge = `<span class="badge badge-green">DELIVERED</span>`;
      if (status === 'read') statusBadge = `<span class="badge badge-green" style="background:#e0f2fe;color:#0369a1;">✓✓ READ</span>`;
      if (status === 'failed') statusBadge = `<span class="badge badge-orange" style="background:#fee2e2;color:#b91c1c;">FAILED</span>`;

      return `
        <tr>
          <td><strong>${this.escapeHtml(msg.customerName || 'Customer')}</strong></td>
          <td><code>${msg.customerPhone || 'N/A'}</code></td>
          <td><span style="font-size:11px;font-weight:600;">${msg.messageType || 'ORDER_CONFIRMED'}</span></td>
          <td>${msg.orderId ? `📦 #${msg.orderId}` : (msg.campaignId ? `🔥 Campaign` : 'Direct')}</td>
          <td>${statusBadge}</td>
          <td><code style="font-size:10px;">${wamid}</code></td>
          <td style="font-size:12px;color:var(--gray-500);">${timeStr}</td>
        </tr>
      `;
    }).join('');
  },

  // Render Analytics Chart
  renderAnalyticsChart() {
    const ctx = document.getElementById('waActivityChart');
    if (!ctx) return;

    const sent = this.messages.filter(m => m.status === 'sent').length;
    const delivered = this.messages.filter(m => m.status === 'delivered').length;
    const read = this.messages.filter(m => m.status === 'read').length;
    const failed = this.messages.filter(m => m.status === 'failed').length;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sent (Awaiting receipt)', 'Delivered to device', 'Read by customer', 'Failed / Invalid'],
        datasets: [{
          data: [sent, delivered, read, failed],
          backgroundColor: ['#3b82f6', '#22c55e', '#0284c7', '#ef4444'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  },

  // Refresh Stats
  fetchLiveStats() {
    this.updateStats();
    this.renderQueue();
    this.renderCampaigns();
    this.renderHistory();
  },

  // HTML Escape Helper
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Bind UI Events
  bindEvents() {
    const searchInput = document.getElementById('wa-queue-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderQueue();
      });
    }
  },

  renderAll() {
    this.updateStats();
    this.renderQueue();
    this.renderCampaigns();
    this.renderHistory();
  }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
  WhatsAppAdmin.init();
});

window.WhatsAppAdmin = WhatsAppAdmin;
