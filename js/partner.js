// js/partner.js - Delivery Partner Dashboard Logic

let map = null;
let marker = null;
let watchId = null;
let currentUser = null;

// Initialize Leaflet map
export function initMap() {
    if (document.getElementById('delivery-map') && !map) {
        map = L.map('delivery-map').setView(
            [13.0850, 80.0178],
            15
        );

        L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                attribution: '© OpenStreetMap contributors'
            }
        ).addTo(map);

        marker = L.marker(
            [13.0850, 80.0178]
        ).addTo(map);
    }
}

// Update status
export function updateStatus() {
    const statusSelect = document.getElementById('status-select');
    const status = statusSelect ? statusSelect.value : 'offline';
    console.log('Status updated to:', status);

    const db = window.FirebaseDB;
    if (currentUser && db && window.Firestore) {
        const { doc, setDoc } = window.Firestore;
        setDoc(
            doc(db, 'deliveryPartners', currentUser.uid),
            {
                status: status,
                timestamp: new Date().toISOString()
            },
            { merge: true }
        ).catch(err => console.error('Firestore status update error:', err));
    }
}

// Start GPS Tracking
export function startTracking() {
    console.log('Start tracking requested');
    const trackingStatus = document.getElementById('tracking-status');
    const statusDot = document.getElementById('status-dot');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                console.log('Location updated: ' + lat + ', ' + lng);

                if (marker && map) {
                    marker.setLatLng([lat, lng]);
                    map.setView([lat, lng], 15);
                } else if (map && !marker) {
                    marker = L.marker([lat, lng]).addTo(map);
                    map.setView([lat, lng], 15);
                }

                if (trackingStatus) {
                    trackingStatus.textContent = 'GPS Tracking Active (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')';
                }

                // Write to Firestore
                const db = window.FirebaseDB;
                if (currentUser && db && window.Firestore) {
                    const { doc, setDoc } = window.Firestore;
                    const statusSelect = document.getElementById('status-select');
                    try {
                        await setDoc(
                            doc(db, 'deliveryPartners', currentUser.uid),
                            {
                                name: currentUser.displayName || 'Delivery Partner',
                                email: currentUser.email,
                                latitude: lat,
                                longitude: lng,
                                status: statusSelect ? statusSelect.value : 'on_delivery',
                                isTracking: true,
                                timestamp: new Date().toISOString()
                            },
                            { merge: true }
                        );
                    } catch (err) {
                        console.error('Firestore setDoc error:', err);
                    }
                }
            },
            (error) => {
                console.error('GPS Tracking Error:', error);
                alert('Geolocation error: ' + error.message);
                stopTracking();
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );

        if (statusDot) statusDot.classList.add('active');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
    } else {
        alert('Geolocation is not supported by your browser.');
    }
}

// Stop GPS Tracking
export function stopTracking() {
    console.log('Stop tracking requested');
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    const trackingStatus = document.getElementById('tracking-status');
    const statusDot = document.getElementById('status-dot');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (trackingStatus) trackingStatus.textContent = 'GPS Tracking Stopped';
    if (statusDot) statusDot.classList.remove('active');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    const db = window.FirebaseDB;
    if (currentUser && db && window.Firestore) {
        const { doc, setDoc } = window.Firestore;
        setDoc(
            doc(db, 'deliveryPartners', currentUser.uid),
            {
                isTracking: false,
                timestamp: new Date().toISOString()
            },
            { merge: true }
        ).catch(err => console.error('Firestore stop tracking update error:', err));
    }
}

function setupAuthListener() {
    const auth = window.FirebaseAuth;
    const db = window.FirebaseDB;

    const {
        onAuthStateChanged,
        signOut
    } = window.FirebaseAuthFns;

    console.log('✅ Firebase Ready');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('✅ Logged in:', user.email);
            currentUser = user;

            const nameEl = document.getElementById('partner-name');
            if (nameEl) {
                nameEl.textContent = user.displayName || 'Delivery Partner';
            }

            const emailEl = document.getElementById('partner-email');
            if (emailEl) {
                emailEl.textContent = user.email;
            }

            // Enable tracking buttons
            const startBtn = document.getElementById('start-btn');
            const stopBtn = document.getElementById('stop-btn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = false;

        } else {
            console.log('❌ No user logged in');
            currentUser = null;
            window.location.href = '../delivery/login.html';
        }
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                alert('Logged out successfully.');
            } catch (error) {
                console.error(error);
            }
        });
    }
}

// Attach firebase-ready listener or run immediately if already initialized
if (window.FirebaseAuth) {
    setupAuthListener();
} else {
    window.addEventListener('firebase-ready', setupAuthListener);
}

// DOM ready listener & event attachments
document.addEventListener('DOMContentLoaded', () => {
    initMap();

    const statusSelect = document.getElementById('status-select');
    if (statusSelect) {
        statusSelect.addEventListener('change', updateStatus);
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startTracking);
    }

    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopTracking);
    }
});
