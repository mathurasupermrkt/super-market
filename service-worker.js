/**
 * Mathura QuickMart — Unified Progressive Web App (PWA) & Messaging Service Worker
 */

// Import Firebase Messaging compat scripts for background push notifications
try {
  importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyCy-euC1CaVTejDj_cCQNgzyJ6uIZHJ0jM",
    authDomain: "mathura-quickmart-v2.firebaseapp.com",
    projectId: "mathura-quickmart-v2",
    storageBucket: "mathura-quickmart-v2.firebasestorage.app",
    messagingSenderId: "365937178136",
    appId: "1:365937178136:web:c3096783b0e1a47d0cb56d"
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "Mathura Quick Mart";
    const options = {
      body: payload?.notification?.body || "New update on your order",
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      data: payload?.data || {}
    };
    self.registration.showNotification(title, options);
  });
} catch (fcmInitErr) {
  console.warn('[PWA SW] FCM background script import skipped or offline:', fcmInitErr);
}

// Notification Click: Secure same-origin navigation & window focusing
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Safely extract and sanitize target URL from notification payload data
  let targetPath = '/';
  const rawUrl = event.notification?.data?.url || event.notification?.data?.link;
  if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    try {
      const parsed = new URL(rawUrl, self.location.origin);
      // Strictly enforce same-origin: only permit routes on this domain
      if (parsed.origin === self.location.origin) {
        targetPath = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch (e) {
      targetPath = '/';
    }
  }

  const destinationUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a matching window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetPath !== '/') {
            client.navigate(destinationUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(destinationUrl);
      }
    })
  );
});

const CACHE_NAME = 'mathura-quickmart-v3';
const PRECACHE_ASSETS = [
  '/',
  '/styles/main.css',
  '/js/app.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon.svg'
];

// Install: Cache essential static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA SW] Pre-caching offline shell');
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[PWA SW] Pre-cache partial fail:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[PWA SW] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Secure caching strategy
// - Never cache Firestore, Auth, APIs, or cross-origin requests
// - Network-first for HTML navigation requests
// - Stale-while-revalidate for same-origin static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests
  if (req.method !== 'GET') return;

  // Only handle same-origin requests (never cache firestore.googleapis.com, identitytoolkit, maps, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip /api/ requests, private endpoints, or firebase messaging workers
  if (url.pathname.startsWith('/api/') || url.pathname.includes('firebase-messaging-sw')) return;

  // Navigation requests (HTML pages): Network-first with cache fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;
          return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline – Mathura Quick Mart</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:2rem;"><h2>🛒 You are currently offline</h2><p>Please check your internet connection to continue shopping.</p><a href="/" style="display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#00695c;color:#fff;text-decoration:none;border-radius:8px;">Retry Home</a></body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Static assets (CSS, JS, images): Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
