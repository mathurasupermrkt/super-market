/**
 * Mathura Quick Mart — Real-Time Notification & Audio Chime Engine
 * Handles Web Audio API synthesis, Firestore onSnapshot real-time streaming,
 * Web Notifications API, and Customer Price-Drop Alerts.
 */

'use strict';

(function(window) {
  // ── 1. WEB AUDIO API SYNTHESIS ENGINE (ZERO EXTERNAL ASSETS) ──
  class NotificationSoundEngine {
    constructor() {
      this.ctx = null;
      this.soundEnabled = this._loadSoundPreference();
      this.unlocked = false;
      this._setupUnlockListener();
    }

    _loadSoundPreference() {
      try {
        return localStorage.getItem('mathura_sound_enabled') !== 'false';
      } catch (_) {
        return true;
      }
    }

    _setupUnlockListener() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const unlock = () => {
        try {
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
          }
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
          this.unlocked = true;
        } catch (_) {}
        ['click', 'touchstart', 'keydown'].forEach(evt => document.removeEventListener(evt, unlock));
      };
      ['click', 'touchstart', 'keydown'].forEach(evt => document.addEventListener(evt, unlock, { once: true }));
    }

    play(type = 'default') {
      if (!this.soundEnabled) return;
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }

        const now = this.ctx.currentTime;

        if (type === 'new_order') {
          // Celebratory 4-note ascending fanfare chime for New Orders: E5, G#5, B5, E6
          const notes = [
            { freq: 659.25, start: 0.00, dur: 0.16 },
            { freq: 830.61, start: 0.12, dur: 0.16 },
            { freq: 987.77, start: 0.24, dur: 0.20 },
            { freq: 1318.51, start: 0.38, dur: 0.45 }
          ];
          notes.forEach(({ freq, start, dur }) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + start);
            gain.gain.setValueAtTime(0.001, now + start);
            gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + dur + 0.05);
          });
        } else if (type === 'price_alert') {
          // Ascending 2-tone melodic chime: C5 (523Hz), G5 (784Hz)
          const notes = [
            { freq: 523.25, start: 0.00, dur: 0.18 },
            { freq: 783.99, start: 0.14, dur: 0.35 }
          ];
          notes.forEach(({ freq, start, dur }) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + start);
            gain.gain.setValueAtTime(0.001, now + start);
            gain.gain.exponentialRampToValueAtTime(0.20, now + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + dur + 0.05);
          });
        } else {
          // Standard gentle notification ping: A5 (880Hz)
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        }
      } catch (err) {
        console.warn('[Notifications Audio] Playback notice:', err);
      }
    }

    toggle() {
      this.soundEnabled = !this.soundEnabled;
      try {
        localStorage.setItem('mathura_sound_enabled', this.soundEnabled ? 'true' : 'false');
      } catch (_) {}
      if (this.soundEnabled) {
        this.play('default'); // quick audible feedback
      }
      return this.soundEnabled;
    }
  }

  // ── 2. MAIN NOTIFICATION MANAGER ──
  const MathuraNotifications = {
    sound: new NotificationSoundEngine(),
    items: [],
    unsubscribe: null,
    initialLoadComplete: false,
    activeRole: null,
    activeUid: null,

    // Initialize listener for admin or logged in customer
    init(role = 'customer', uid = null) {
      this.activeRole = role;
      this.activeUid = uid;

      if (!window.FirebaseDB || !window.Firestore) {
        window.addEventListener('firebase-ready', () => this.init(role, uid), { once: true });
        return;
      }

      this.startRealtimeListener();
      this.updateSoundButtonUI();
    },

    startRealtimeListener() {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }

      const db = window.FirebaseDB;
      const fs = window.Firestore;
      if (!db || !fs) return;

      const notifsCol = fs.collection(db, 'notifications');
      let q = null;

      if (this.activeRole === 'admin') {
        q = fs.query(
          notifsCol,
          fs.where('recipientRole', '==', 'admin')
        );
      } else if (this.activeUid) {
        q = fs.query(
          notifsCol,
          fs.where('recipientUid', '==', this.activeUid)
        );
      } else {
        // Guest user: no real-time stream
        this.items = [];
        this.updateBadgeUI(0);
        return;
      }

      this.initialLoadComplete = false;

      this.unsubscribe = fs.onSnapshot(q, (snapshot) => {
        const notifs = [];
        snapshot.forEach(doc => {
          notifs.push({ id: doc.id, ...doc.data() });
        });

        // Sort descending by creation date
        notifs.sort((a, b) => {
          const tA = new Date(a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });

        this.items = notifs;

        // Process document additions (skip sound on initial snapshot load)
        if (this.initialLoadComplete) {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data && !data.isRead) {
                this.onNewNotificationReceived({ id: change.doc.id, ...data });
              }
            }
          });
        } else {
          this.initialLoadComplete = true;
        }

        const unreadCount = this.getUnreadCount();
        this.updateBadgeUI(unreadCount);
        this.renderDropdown();

        // Also refresh customer notifications page if present
        if (typeof window.renderDynamicNotifications === 'function') {
          window.renderDynamicNotifications();
        }
      }, (err) => {
        console.warn('[Notifications] Firestore snapshot error:', err);
      });
    },

    onNewNotificationReceived(notif) {
      // 1. Play appropriate sound chime
      if (notif.type === 'new_order') {
        this.sound.play('new_order');
      } else if (notif.type === 'price_alert') {
        this.sound.play('price_alert');
      } else {
        this.sound.play('default');
      }

      // 2. Display Toast
      if (typeof MathuraQuickMart !== 'undefined' && typeof MathuraQuickMart.toast === 'function') {
        const toastType = notif.type === 'new_order' ? 'success' : 'info';
        MathuraQuickMart.toast(`🔔 ${notif.title}\n${notif.message}`, toastType, 5000);
      }

      // 3. Desktop / System Push Notification if backgrounded
      this.showBrowserNotification(notif.title, notif.message, notif.link);

      // 4. Dispatch DOM event for page integration
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-received', { detail: notif }));
      }
    },

    getUnreadCount() {
      return this.items.filter(n => !n.isRead).length;
    },

    async markAsRead(notificationId) {
      const notif = this.items.find(n => n.id === notificationId);
      if (notif) notif.isRead = true;

      const unreadCount = this.getUnreadCount();
      this.updateBadgeUI(unreadCount);
      this.renderDropdown();

      if (window.FirebaseDB && window.Firestore) {
        try {
          const db = window.FirebaseDB;
          const fs = window.Firestore;
          await fs.updateDoc(fs.doc(db, 'notifications', notificationId), {
            isRead: true,
            readAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn('[Notifications] Mark as read error:', e);
        }
      }
    },

    async markAllAsRead() {
      const unreadItems = this.items.filter(n => !n.isRead);
      if (unreadItems.length === 0) return;

      unreadItems.forEach(n => { n.isRead = true; });
      this.updateBadgeUI(0);
      this.renderDropdown();

      if (window.FirebaseDB && window.Firestore) {
        try {
          const db = window.FirebaseDB;
          const fs = window.Firestore;
          const nowISO = new Date().toISOString();
          const promises = unreadItems.map(item => {
            return fs.updateDoc(fs.doc(db, 'notifications', item.id), {
              isRead: true,
              readAt: nowISO
            }).catch(() => {});
          });
          await Promise.all(promises);
          if (typeof MathuraQuickMart !== 'undefined') {
            MathuraQuickMart.toast('✓ All notifications marked as read', 'success');
          }
        } catch (e) {
          console.warn('[Notifications] Mark all read error:', e);
        }
      }
    },

    async deleteNotification(notificationId) {
      this.items = this.items.filter(n => n.id !== notificationId);
      this.updateBadgeUI(this.getUnreadCount());
      this.renderDropdown();

      if (window.FirebaseDB && window.Firestore) {
        try {
          const db = window.FirebaseDB;
          const fs = window.Firestore;
          await fs.deleteDoc(fs.doc(db, 'notifications', notificationId));
        } catch (e) {
          console.warn('[Notifications] Delete notification error:', e);
        }
      }
    },

    // ── 3. BROWSER WEB NOTIFICATIONS API ──
    async requestBrowserPermission() {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        if (typeof MathuraQuickMart !== 'undefined') {
          MathuraQuickMart.toast('Web notifications are not supported by this browser.', 'warning');
        }
        return false;
      }
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          if (typeof MathuraQuickMart !== 'undefined') {
            MathuraQuickMart.toast('🔔 Push notifications enabled successfully!', 'success');
          }
          return true;
        } else {
          if (typeof MathuraQuickMart !== 'undefined') {
            MathuraQuickMart.toast('Push notifications were blocked or dismissed in browser settings.', 'warning');
          }
          return false;
        }
      } catch (e) {
        console.warn('[Notifications] Permission request error:', e);
        return false;
      }
    },

    showBrowserNotification(title, body, url = null) {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      if (!document.hidden) return; // Only show system notification when tab is in background

      try {
        const notif = new Notification(title || 'Mathura Quick Mart', {
          body: body || '',
          icon: '/images/icon.svg',
          badge: '/images/icon.svg',
          tag: 'mqm-alert-' + Date.now()
        });
        notif.onclick = function() {
          window.focus();
          if (url) window.location.href = url;
          notif.close();
        };
      } catch (e) {
        console.warn('[Notifications] Browser notification error:', e);
      }
    },

    // ── 4. CUSTOMER PRICE ALERTS ──
    async setPriceAlert(productId, targetPrice, currentPrice = 0, productName = 'Product') {
      const user = (typeof MathuraQuickMart !== 'undefined' && MathuraQuickMart.state)
        ? MathuraQuickMart.state.user
        : null;

      if (!user || !user.uid) {
        if (typeof MathuraQuickMart !== 'undefined') {
          MathuraQuickMart.toast('Please log in to set a price drop alert.', 'error');
          setTimeout(() => { window.location.href = '/customer/login.html'; }, 1000);
        }
        return false;
      }

      const pId = String(productId);
      const target = Number(targetPrice);
      if (!target || target <= 0) {
        if (typeof MathuraQuickMart !== 'undefined') {
          MathuraQuickMart.toast('Please enter a valid target price greater than ₹0.', 'warning');
        }
        return false;
      }

      if (window.FirebaseDB && window.Firestore) {
        try {
          const db = window.FirebaseDB;
          const fs = window.Firestore;
          const alertDocId = `${user.uid}_${pId}`;
          const alertRef = fs.doc(db, 'priceAlerts', alertDocId);

          await fs.setDoc(alertRef, {
            id: alertDocId,
            customerUid: user.uid,
            productId: pId,
            productName: productName,
            targetPrice: target,
            initialPrice: Number(currentPrice) || target,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastNotifiedPrice: null
          }, { merge: true });

          if (typeof MathuraQuickMart !== 'undefined') {
            MathuraQuickMart.toast(`📉 Price alert set for ${productName} at ₹${target}! We will notify you when price drops.`, 'success', 5000);
          }
          return true;
        } catch (e) {
          console.error('[Notifications] Set price alert error:', e);
          if (typeof MathuraQuickMart !== 'undefined') {
            MathuraQuickMart.toast('Failed to save price alert. Please try again.', 'error');
          }
          return false;
        }
      }
      return false;
    },

    async getPriceAlert(productId) {
      const user = (typeof MathuraQuickMart !== 'undefined' && MathuraQuickMart.state)
        ? MathuraQuickMart.state.user
        : null;
      if (!user || !user.uid || !window.FirebaseDB || !window.Firestore) return null;

      try {
        const db = window.FirebaseDB;
        const fs = window.Firestore;
        const snap = await fs.getDoc(fs.doc(db, 'priceAlerts', `${user.uid}_${productId}`));
        if (snap.exists() && snap.data().isActive) {
          return snap.data();
        }
      } catch (_) {}
      return null;
    },

    async deletePriceAlert(productId) {
      const user = (typeof MathuraQuickMart !== 'undefined' && MathuraQuickMart.state)
        ? MathuraQuickMart.state.user
        : null;
      if (!user || !user.uid || !window.FirebaseDB || !window.Firestore) return false;

      try {
        const db = window.FirebaseDB;
        const fs = window.Firestore;
        await fs.deleteDoc(fs.doc(db, 'priceAlerts', `${user.uid}_${productId}`));
        if (typeof MathuraQuickMart !== 'undefined') {
          MathuraQuickMart.toast('Price alert removed.', 'success');
        }
        return true;
      } catch (_) {
        return false;
      }
    },

    // ── 5. UI BINDINGS & DROPDOWN RENDERING ──
    updateBadgeUI(count) {
      const badges = document.querySelectorAll('[data-notif-count], #admin-notif-badge, #customer-notif-badge');
      badges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? '' : 'none';
        if (count > 0) {
          b.classList.remove('animate-pulse');
          void b.offsetWidth; // trigger reflow
          b.classList.add('animate-pulse');
        }
      });
    },

    updateSoundButtonUI() {
      const soundBtns = document.querySelectorAll('[data-sound-toggle]');
      soundBtns.forEach(btn => {
        btn.textContent = this.sound.soundEnabled ? '🔊 Sound ON' : '🔇 Muted';
        btn.title = this.sound.soundEnabled ? 'Click to Mute' : 'Click to Unmute';
      });
    },

    toggleSound() {
      const enabled = this.sound.toggle();
      this.updateSoundButtonUI();
      if (typeof MathuraQuickMart !== 'undefined') {
        MathuraQuickMart.toast(enabled ? '🔊 Notification sounds enabled' : '🔇 Notification sounds muted', 'info');
      }
      return enabled;
    },

    toggleDropdown(menuId = 'customer-notif-menu') {
      const menu = document.getElementById(menuId);
      if (!menu) return;
      const isOpen = menu.style.display === 'block';
      // Close other dropdowns
      document.querySelectorAll('.dropdown-menu, .admin-notif-dropdown').forEach(m => {
        if (m !== menu) m.style.display = 'none';
      });
      menu.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        this.renderDropdown(menuId);
      }
    },

    renderDropdown(menuId = null) {
      const targetIds = menuId ? [menuId] : ['admin-notif-dropdown', 'customer-notif-menu'];

      targetIds.forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;

        const isAudioOn = this.sound.soundEnabled;
        const unreadCount = this.getUnreadCount();

        let headerHtml = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
            <div style="font-weight:700;font-size:14px;color:#1e293b;">
              Notifications ${unreadCount > 0 ? `<span style="background:var(--primary);color:#fff;font-size:10px;padding:2px 7px;border-radius:12px;margin-left:4px;">${unreadCount}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button onclick="MathuraNotifications.toggleSound()" style="background:none;border:none;cursor:pointer;font-size:15px;" title="${isAudioOn ? 'Mute Sound' : 'Unmute Sound'}">
                ${isAudioOn ? '🔊' : '🔇'}
              </button>
              ${unreadCount > 0 ? `<button onclick="MathuraNotifications.markAllAsRead()" style="background:none;border:none;color:var(--primary-dark);font-size:11px;font-weight:600;cursor:pointer;">Mark all read</button>` : ''}
            </div>
          </div>
        `;

        if (this.items.length === 0) {
          container.innerHTML = `
            ${headerHtml}
            <div style="padding:28px 16px;text-align:center;color:#64748b;font-size:13px;">
              <div style="font-size:24px;margin-bottom:6px;">🔔</div>
              No notifications yet.
            </div>
          `;
          return;
        }

        const itemsHtml = this.items.slice(0, 15).map(n => {
          const isNewOrder = n.type === 'new_order';
          const isPriceAlert = n.type === 'price_alert';
          const isUnread = !n.isRead;
          const bg = isUnread ? (isNewOrder ? '#fef3c7' : '#f0fdf4') : '#ffffff';
          const borderLeft = isUnread ? (isNewOrder ? '4px solid #f59e0b' : '4px solid #16a34a') : '4px solid transparent';
          const icon = isNewOrder ? '🛒' : (isPriceAlert ? '📉' : '📦');
          const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return `
            <div onclick="MathuraNotifications.onItemClick('${n.id}', '${n.link || ''}')"
              style="padding:10px 14px;border-bottom:1px solid #f1f5f9;background:${bg};border-left:${borderLeft};cursor:pointer;transition:background 0.15s ease;display:flex;gap:10px;align-items:flex-start;">
              <div style="font-size:20px;line-height:1;margin-top:2px;">${icon}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                  <strong style="font-size:12px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.title || 'Notification'}</strong>
                  <span style="font-size:10px;color:#94a3b8;flex-shrink:0;">${timeStr}</span>
                </div>
                <div style="font-size:11px;color:#475569;line-height:1.4;">${n.message || ''}</div>
              </div>
            </div>
          `;
        }).join('');

        const footerHtml = `
          <div style="padding:8px 12px;text-align:center;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <a href="${this.activeRole === 'admin' ? '/admin/dashboard.html?tab=orders' : '/customer/notifications.html'}" style="font-size:11px;color:var(--primary-dark);font-weight:600;text-decoration:none;">
              ${this.activeRole === 'admin' ? 'View Orders in Admin →' : 'View Full Notifications →'}
            </a>
          </div>
        `;

        container.innerHTML = headerHtml + `<div style="max-height:340px;overflow-y:auto;">${itemsHtml}</div>` + footerHtml;
      });
    },

    onItemClick(id, link) {
      this.markAsRead(id);
      if (link) {
        if (this.activeRole === 'admin' && typeof window.switchTab === 'function' && link.includes('tab=')) {
          const tab = new URLSearchParams(link.split('?')[1] || '').get('tab');
          if (tab) window.switchTab(tab);
        } else {
          window.location.href = link;
        }
      }
    }
  };

  // Close dropdown on outside click
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#nav-notif-dropdown-wrapper') &&
          !e.target.closest('#admin-notif-wrapper') &&
          !e.target.closest('#nav-notif-btn') &&
          !e.target.closest('#admin-notif-btn')) {
        const d1 = document.getElementById('customer-notif-menu');
        const d2 = document.getElementById('admin-notif-dropdown');
        if (d1) d1.style.display = 'none';
        if (d2) d2.style.display = 'none';
      }
    });
  }

  // Export globally
  window.MathuraNotifications = MathuraNotifications;

})(typeof window !== 'undefined' ? window : this);

