/**
 * Mathura Quick Mart - Centralized Leaflet & OpenStreetMap Service
 * Provides store location, customer address pin selection, live partner tracking,
 * Nominatim geocoding with caching & rate-limiting, and OSRM routing.
 */

(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.MQMap = api;
  }
  if (global) {
    global.MQMap = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ── Default Store Coordinates (Madakottan, Ramanathapuram, Tamil Nadu - 623504) ──
  const DEFAULT_STORE = {
    lat: 9.3639,
    lng: 78.8395,
    name: 'Mathura Quick Mart',
    address: 'Madakottan, Ramanathapuram, Tamil Nadu - 623504',
    phone: '+91 98765 43210'
  };

  const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  let cachedStoreLocation = null;

  // ── Caching & Rate Limiting for Nominatim ─────────────────────────────────
  const geocodeCache = new Map();
  let lastNominatimRequestTime = 0;
  const MIN_NOMINATIM_INTERVAL_MS = 1050; // At least 1 second between calls to respect OSM usage policy

  function formatCoordKey(lat, lng) {
    return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  }

  async function throttleNominatim() {
    const now = Date.now();
    const elapsed = now - lastNominatimRequestTime;
    if (elapsed < MIN_NOMINATIM_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_NOMINATIM_INTERVAL_MS - elapsed));
    }
    lastNominatimRequestTime = Date.now();
  }

  // ── Store Location Retrieval ─────────────────────────────────────────────
  async function getStoreLocation() {
    if (cachedStoreLocation) return cachedStoreLocation;

    // Check Firestore settings/store if available
    try {
      if (typeof window !== 'undefined' && window.Firestore && window.FirebaseDB) {
        const snap = await window.Firestore.getDoc(
          window.Firestore.doc(window.FirebaseDB, 'settings', 'store')
        );
        if (snap.exists()) {
          const d = snap.data();
          const lat = Number(d.storeLatitude ?? d.latitude ?? d.lat);
          const lng = Number(d.storeLongitude ?? d.longitude ?? d.lng);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            cachedStoreLocation = {
              lat,
              lng,
              name: d.storeName || DEFAULT_STORE.name,
              address: d.storeLocation || d.address || DEFAULT_STORE.address,
              phone: d.whatsappNumber || DEFAULT_STORE.phone
            };
            return cachedStoreLocation;
          }
        }
      }
    } catch (e) {
      console.warn('[MQMap] Could not fetch store settings from Firestore, using defaults:', e.message);
    }

    cachedStoreLocation = { ...DEFAULT_STORE };
    return cachedStoreLocation;
  }

  // ── Create Leaflet Map Instance ──────────────────────────────────────────
  function createMap(containerId, options = {}) {
    if (typeof L === 'undefined') {
      throw new Error('Leaflet library (L) is not loaded. Please include Leaflet CSS & JS.');
    }

    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      console.warn('[MQMap] Map container not found:', containerId);
      return null;
    }

    // Clean up existing Leaflet map on this container to avoid "already initialized" error
    if (container._leaflet_id && container._leaflet_map) {
      try {
        container._leaflet_map.remove();
      } catch (e) {}
      container._leaflet_id = null;
      container._leaflet_map = null;
    }

    const defaultCenter = [options.center?.lat || DEFAULT_STORE.lat, options.center?.lng || DEFAULT_STORE.lng];
    const defaultZoom = options.zoom || 15;

    const map = L.map(container, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: options.zoomControl !== false,
      scrollWheelZoom: options.scrollWheelZoom !== false,
      attributionControl: true,
      ...options.leafletOptions
    });

    // Add standard OpenStreetMap tiles
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION
    }).addTo(map);

    // Save reference on DOM container
    container._leaflet_map = map;

    // Trigger size invalidation once container is visible
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 150);

    return map;
  }

  // ── Custom HTML Markers ──────────────────────────────────────────────────
  function createStoreMarker(lat, lng, storeInfo = {}) {
    const info = { ...DEFAULT_STORE, ...storeInfo };
    const icon = L.divIcon({
      className: 'leaflet-custom-marker store-marker',
      html: `
        <div class="marker-pulse store-pulse"></div>
        <div class="marker-pin store-pin">
          <div class="marker-pin-inner">🏪</div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([lat, lng], { icon, title: info.name });
    marker.bindPopup(`
      <div class="map-popup-header">
        <span>🏪</span> ${escapeHtml(info.name)}
      </div>
      <div class="map-popup-sub">${escapeHtml(info.address)}</div>
      <span class="map-popup-badge">Main Store Outlet</span>
    `);
    return marker;
  }

  function createCustomerMarker(lat, lng, options = {}) {
    const icon = L.divIcon({
      className: 'leaflet-custom-marker customer-marker',
      html: `
        <div class="marker-pin customer-pin">
          <div class="marker-pin-inner">📍</div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([lat, lng], {
      icon,
      draggable: Boolean(options.draggable),
      title: options.title || 'Delivery Destination'
    });

    if (options.popupContent) {
      marker.bindPopup(options.popupContent);
    } else {
      marker.bindPopup(`
        <div class="map-popup-header">
          <span>📍</span> Delivery Location
        </div>
        <div class="map-popup-sub" id="cust-marker-popup-addr">Selected destination for your groceries.</div>
      `);
    }

    if (options.onDragEnd && typeof options.onDragEnd === 'function') {
      marker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        options.onDragEnd({ lat: pos.lat, lng: pos.lng });
      });
    }

    return marker;
  }

  function createRiderMarker(lat, lng, riderInfo = {}) {
    const icon = L.divIcon({
      className: 'leaflet-custom-marker rider-marker',
      html: `
        <div class="marker-pulse"></div>
        <div class="marker-pin rider-pin">
          <div class="marker-pin-inner">🛵</div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    const marker = L.marker([lat, lng], {
      icon,
      title: riderInfo.name || 'Delivery Partner'
    });

    const updatePopup = (info) => {
      const timeStr = info.timestamp ? new Date(info.timestamp).toLocaleTimeString('en-IN') : 'Just now';
      marker.bindPopup(`
        <div class="map-popup-header">
          <span>🛵</span> ${escapeHtml(info.name || 'Delivery Partner')}
        </div>
        <div class="map-popup-sub">
          <strong>Phone:</strong> ${escapeHtml(info.phone || 'Available upon dispatch')}<br>
          <strong>Last Update:</strong> ${timeStr}
        </div>
        <span class="map-popup-badge live">🟢 Live GPS Tracking</span>
      `);
    };

    updatePopup(riderInfo);
    marker._updateRiderPopup = updatePopup;
    return marker;
  }

  // ── Reverse Geocoding via Nominatim with Caching ─────────────────────────
  async function reverseGeocode(lat, lng) {
    const key = formatCoordKey(lat, lng);
    if (geocodeCache.has(key)) {
      return geocodeCache.get(key);
    }

    // Check sessionStorage cache
    try {
      const stored = sessionStorage.getItem(`mq_geo_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        geocodeCache.set(key, parsed);
        return parsed;
      }
    } catch (e) {}

    await throttleNominatim();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const addr = data.address || {};

      const formatted = data.display_name ||
        [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state, addr.postcode]
          .filter(Boolean)
          .join(', ');

      const result = {
        formattedAddress: formatted || `Location (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`,
        road: addr.road || '',
        suburb: addr.suburb || addr.neighbourhood || '',
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || 'Tamil Nadu',
        postcode: addr.postcode || '',
        country: addr.country || 'India',
        raw: data
      };

      geocodeCache.set(key, result);
      try {
        sessionStorage.setItem(`mq_geo_${key}`, JSON.stringify(result));
      } catch (e) {}

      return result;
    } catch (e) {
      console.warn('[MQMap] Reverse geocode note:', e.message);
      const fallback = {
        formattedAddress: `Coordinates: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
        road: '', suburb: '', city: 'Ramanathapuram', state: 'Tamil Nadu', postcode: '623504', country: 'India'
      };
      return fallback;
    }
  }

  // ── Address Search via Nominatim ──────────────────────────────────────────
  async function searchAddress(query) {
    if (!query || query.trim().length < 3) return [];

    await throttleNominatim();

    try {
      // Prioritize Ramanathapuram, Tamil Nadu bounding context
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();

      return list.map(item => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        formattedAddress: item.display_name,
        city: item.address?.city || item.address?.town || item.address?.village || '',
        state: item.address?.state || ''
      }));
    } catch (e) {
      console.warn('[MQMap] Address search error:', e);
      return [];
    }
  }

  // ── OSRM Route Service with Straight-Line Fallback ────────────────────────
  function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  async function fetchRoute(startLatLng, endLatLng) {
    const sLat = Number(startLatLng.lat || startLatLng[0]);
    const sLng = Number(startLatLng.lng || startLatLng[1]);
    const eLat = Number(endLatLng.lat || endLatLng[0]);
    const eLng = Number(endLatLng.lng || endLatLng[1]);

    const straightLine = [[sLat, sLng], [eLat, eLng]];
    const directKm = calculateHaversineDistanceKm(sLat, sLng, eLat, eLng);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const route = data.routes[0];
        // OSRM coordinates are [lng, lat], Leaflet polyline requires [lat, lng]
        const latLngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
        return {
          coordinates: latLngs,
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMin: Math.max(1, Math.round(route.duration / 60)),
          isOsrm: true
        };
      }
    } catch (e) {
      console.warn('[MQMap] OSRM route unavailable, using direct path:', e.message);
    }

    return {
      coordinates: straightLine,
      distanceKm: directKm,
      durationMin: Math.max(2, Math.round(directKm * 3.5)), // ~17 km/h city estimate
      isOsrm: false
    };
  }

  async function drawRoute(map, startLatLng, endLatLng, options = {}) {
    if (!map || typeof L === 'undefined') return null;

    const routeData = await fetchRoute(startLatLng, endLatLng);

    const style = {
      color: options.color || '#059669',
      weight: options.weight || 5,
      opacity: options.opacity || 0.85,
      dashArray: routeData.isOsrm ? null : '8, 8', // Dashed line if direct fallback
      lineJoin: 'round',
      ...options.lineOptions
    };

    const polyline = L.polyline(routeData.coordinates, style).addTo(map);

    if (options.fitBounds !== false) {
      try {
        map.fitBounds(polyline.getBounds(), { padding: [35, 35] });
      } catch (e) {}
    }

    return {
      polyline,
      ...routeData
    };
  }

  // ── Recenter Control ─────────────────────────────────────────────────────
  function addRecenterButton(map, onClick) {
    if (!map || typeof L === 'undefined') return;

    const RecenterControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar');
        const btn = L.DomUtil.create('a', 'leaflet-control-recenter', container);
        btn.innerHTML = '🎯';
        btn.href = '#';
        btn.title = 'Re-center map';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Re-center map');

        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', function (e) {
          L.DomEvent.stop(e);
          if (typeof onClick === 'function') onClick();
        });

        return container;
      }
    });

    map.addControl(new RecenterControl());
  }

  // ── Utilities ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    DEFAULT_STORE,
    OSM_TILE_URL,
    OSM_ATTRIBUTION,
    getStoreLocation,
    createMap,
    createStoreMarker,
    createCustomerMarker,
    createRiderMarker,
    reverseGeocode,
    searchAddress,
    fetchRoute,
    drawRoute,
    addRecenterButton,
    calculateHaversineDistanceKm
  };
});
