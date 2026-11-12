// Mathura Quick Mart — Staging Service Worker (FCM & PWA)
/*
  Mirrors the production worker but uses the *staging* Firebase configuration.
  Replace the <STAGING_...> placeholders with real values from the Firebase console.
  If placeholders remain, FCM initialization will be skipped and a warning logged.
*/
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js");

// ---- STAGING CONFIGURATION ----
const firebaseConfig = {
  apiKey: "AIzaSyCsz2puyiJ7GyR9We4sf11cI_XxeNZ1cas",
  authDomain: "mathura-quick-mart-staging.firebaseapp.com",
  projectId: "mathura-quick-mart-staging",
  storageBucket: "mathura-quick-mart-staging.firebasestorage.app",
  messagingSenderId: "902584090641",
  appId: "1:902584090641:web:feea008413aeec290d31b0",
  measurementId: "G-FKF9SRHYLS"
};

// If any placeholder is still present, abort Firebase init (FCM will be disabled).
const placeholderFound = Object.values(firebaseConfig).some(v => typeof v === "string" && v.startsWith("<STAGING_"));
if (placeholderFound) {
  console.warn("[Staging SW] ⚠️ Staging Firebase config placeholders are still present – FCM will not be initialized.");
} else {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const title = payload?.notification?.title || "Mathura Quick Mart (Staging)";
    const options = {
      body: payload?.notification?.body || "New update on your order",
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      data: payload?.data || {}
    };
    self.registration.showNotification(title, options);
  });

  // Notification click – same‑origin guard
  self.addEventListener("notificationclick", event => {
    event.notification.close();
    let targetPath = "/";
    const rawUrl = event.notification?.data?.url || event.notification?.data?.link;
    if (typeof rawUrl === "string" && rawUrl.trim().length > 0) {
      try {
        const parsed = new URL(rawUrl, self.location.origin);
        if (parsed.origin === self.location.origin) targetPath = parsed.pathname + parsed.search + parsed.hash;
      } catch (_) { }
    }
    const destinationUrl = new URL(targetPath, self.location.origin).href;
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
        for (const client of windows) {
          if (client.url && client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client && targetPath !== "/") client.navigate(destinationUrl);
            return client.focus();
          }
        }
        return clients.openWindow(destinationUrl);
      })
    );
  });

  // ---- CACHE ----
  const CACHE_NAME = "mathura-quickmart-staging-v1";
  const PRECACHE_ASSETS = [
    "/",
    "/styles/main.css",
    "/js/app.js",
    "/manifest.json",
    "/images/icon-192.png",
    "/images/icon-512.png",
    "/images/icon.svg"
  ];

  self.addEventListener("install", event => {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        console.log("[Staging SW] Pre‑caching assets");
        return cache.addAll(PRECACHE_ASSETS).catch(err => console.warn("[Staging SW] Pre‑cache partial fail:", err));
      }).then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", event => {
    const CACHE_PREFIX = "mathura-quickmart-staging-";
    event.waitUntil(
      caches.keys().then(names => Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME && name.startsWith(CACHE_PREFIX)) {
            console.log("[Staging SW] Removing old cache:", name);
            return caches.delete(name);
          }
        })
      )).then(() => self.clients.claim())
    );
  });

  self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname.includes("firebase-messaging-sw")) return;

    // Navigation (HTML) – network first
    if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
      event.respondWith(
        fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return resp;
        }).catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || new Response("<!DOCTYPE html><h2>Offline</h2>", { headers: { "Content-Type": "text/html" } });
        })
      );
      return;
    }

    // Static assets – stale‑while‑revalidate
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
  });
}
