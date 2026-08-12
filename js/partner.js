// js/partner.js - Delivery Partner Dashboard Logic

let map = null;
let marker = null;
let watchId = null;
let currentUser = null;

// Incoming Order State
let ordersUnsubscribe = null;
let currentIncomingOrderId = null;
let incomingOrderTimer = null;


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

    if (status === 'available') {
        listenForIncomingOrders();
    } else {
        stopListeningForOrders();
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

            // Start listening if currently available
            const statusSelect = document.getElementById('status-select');
            if (statusSelect && statusSelect.value === 'available') {
                listenForIncomingOrders();
            }

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

    const acceptBtn = document.getElementById('accept-order-btn');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptOrder);
    }

    const declineBtn = document.getElementById('decline-order-btn');
    if (declineBtn) {
        declineBtn.addEventListener('click', () => declineOrder(currentIncomingOrderId));
    }
});

// Incoming Order Logic

export function listenForIncomingOrders() {
    const statusSelect = document.getElementById('status-select');
    const status = statusSelect ? statusSelect.value : 'offline';
    
    if (status !== 'available' || !currentUser) {
        stopListeningForOrders();
        return;
    }

    if (ordersUnsubscribe) return; // Already listening

    console.log('Started listening for incoming orders...');
    const db = window.FirebaseDB;
    const { collection, query, where, onSnapshot } = window.Firestore;

    const q = query(
        collection(db, 'orders'),
        where('deliveryRequestStatus', '==', 'pending')
    );

    ordersUnsubscribe = onSnapshot(q, (snapshot) => {
        const currentStatus = document.getElementById('status-select').value;
        if (currentStatus !== 'available') {
            stopListeningForOrders();
            return;
        }

        let foundOrder = null;
        snapshot.forEach(docSnap => {
            if (foundOrder) return;
            const data = docSnap.data();
            
            const declined = data.declinedDrivers || [];
            if (declined.includes(currentUser.uid)) return;

            const expiresAt = new Date(data.deliveryRequestExpiresAt || Date.now()).getTime();
            if (Date.now() < expiresAt) {
                foundOrder = { id: docSnap.id, ...data };
            }
        });

        if (foundOrder) {
            if (currentIncomingOrderId !== foundOrder.id) {
                showIncomingOrder(foundOrder);
            }
        } else {
            hideIncomingOrder();
        }
    });
}

export function stopListeningForOrders() {
    if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
        console.log('Stopped listening for incoming orders.');
    }
    hideIncomingOrder();
}

function showIncomingOrder(order) {
    currentIncomingOrderId = order.id;
    const modal = document.getElementById('incoming-order-modal');
    if (!modal) return;

    document.getElementById('incoming-order-id').textContent = order.id;
    document.getElementById('incoming-customer-name').textContent = order.customerName || 'Customer';
    document.getElementById('incoming-total-amount').textContent = order.total || order.subtotal || order.totalAmount || '0';

    // Delivery address
    const addrEl = document.getElementById('incoming-address');
    if (addrEl) {
        const addr = order.deliveryAddress || order.address || order.shipping?.address || '';
        addrEl.textContent = addr || 'Address not provided';
    }

    // Items preview
    const itemsEl = document.getElementById('incoming-items-preview');
    if (itemsEl) {
        const items = order.items || order.products || order.cartItems || [];
        if (items.length > 0) {
            itemsEl.innerHTML = '<strong>🛒 Items:</strong><br>' + items.slice(0, 5).map(it => {
                const qty = it.qty || it.quantity || 1;
                const name = it.name || it.title || 'Product';
                return `• ${name} × ${qty}`;
            }).join('<br>') + (items.length > 5 ? `<br>... and ${items.length - 5} more` : '');
        } else {
            itemsEl.innerHTML = '<em style="color:#94a3b8;">Item details not available</em>';
        }
    }

    
    const timerEl = document.getElementById('incoming-timer');
    const expiresAt = new Date(order.deliveryRequestExpiresAt).getTime();

    if (incomingOrderTimer) clearInterval(incomingOrderTimer);
    
    const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        timerEl.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(incomingOrderTimer);
            declineOrder(order.id); // Auto-decline when timer runs out
        }
    };
    
    updateTimer();
    incomingOrderTimer = setInterval(updateTimer, 1000);
    modal.style.display = 'flex';
}

function hideIncomingOrder() {
    const modal = document.getElementById('incoming-order-modal');
    if (modal) modal.style.display = 'none';
    if (incomingOrderTimer) clearInterval(incomingOrderTimer);
    currentIncomingOrderId = null;
}

async function acceptOrder() {
    if (!currentIncomingOrderId || !currentUser) return;
    const orderId = currentIncomingOrderId;
    const db = window.FirebaseDB;
    const { doc, runTransaction } = window.Firestore;
    
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw 'Order does not exist!';
            
            const data = orderSnap.data();
            if (data.deliveryRequestStatus !== 'pending' || data.driverId) {
                throw 'Order already assigned to someone else or expired!';
            }
            
            transaction.update(orderRef, {
                driverId: currentUser.uid,
                driverName: currentUser.displayName || currentUser.email.split('@')[0],
                deliveryRequestStatus: 'accepted',
                status: 'assigned'
            });
        });
        
        alert('Order Accepted Successfully! Please proceed with the delivery.');
        
        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.value = 'on_delivery';
            updateStatus();
        }
    } catch (e) {
        alert('Could not accept order: ' + e);
        hideIncomingOrder();
    }
}

async function declineOrder(orderId) {
    if (!orderId || !currentUser) return;
    const db = window.FirebaseDB;
    const { doc, arrayUnion, updateDoc } = window.Firestore;
    
    hideIncomingOrder();
    
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            declinedDrivers: arrayUnion(currentUser.uid)
        });
    } catch (e) {
        console.error('Error declining order:', e);
    }
}

