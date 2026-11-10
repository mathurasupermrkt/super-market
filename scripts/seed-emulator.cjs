/**
 * Mathura Quick Mart - Local Firebase Emulator Data Seeding Script
 * 
 * STRICT LOCAL EMULATOR ONLY:
 * - Hard-locks FIRESTORE_EMULATOR_HOST to 127.0.0.1:8080
 * - Performs pre-flight health check to ensure Firestore emulator is running
 * - Fail-closed: exits immediately if the emulator is not detected
 * - Idempotent: running multiple times preserves decremented stock and existing store settings
 * - Never accesses or modifies production Firebase
 */

const http = require('http');

// 1. HARD-LOCK EMULATOR ENVIRONMENT
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;
process.env.FIRESTORE_EMULATOR_HOST = `${EMULATOR_HOST}:${EMULATOR_PORT}`;

// 2. PRE-FLIGHT EMULATOR HEALTH CHECK
function checkEmulatorHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${EMULATOR_HOST}:${EMULATOR_PORT}/`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 && data.trim() === 'Ok') {
          resolve(true);
        } else {
          reject(new Error(`Unexpected response from emulator at ${EMULATOR_HOST}:${EMULATOR_PORT} - status: ${res.statusCode}, body: ${data}`));
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`Cannot connect to Firestore emulator at ${EMULATOR_HOST}:${EMULATOR_PORT}. Ensure 'firebase emulators:start' is running. Error: ${err.message}`));
    });
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error(`Connection to Firestore emulator at ${EMULATOR_HOST}:${EMULATOR_PORT} timed out.`));
    });
  });
}

// 3. SAMPLE TEST DATA SCHEMAS MATCHING APPLICATION & CALLABLE FUNCTION REQUIREMENTS

const TEST_PRODUCTS = [
  {
    id: 1,
    name: 'Fresh Organic Apples',
    category: 'Fruits & Vegetables',
    price: 149,
    originalPrice: 199,
    mrp: 199,
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400',
    weight: '1 kg',
    unit: '1 kg',
    rating: 4.5,
    reviews: 234,
    discount: 25,
    badge: 'Organic',
    stock: 50,
    featured: true,
    bestSeller: true,
    isNew: false
  },
  {
    id: 2,
    name: 'Whole Milk (Amul)',
    category: 'Dairy & Eggs',
    price: 68,
    originalPrice: 72,
    mrp: 72,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
    weight: '1 litre',
    unit: '1 litre',
    rating: 4.8,
    reviews: 1024,
    discount: 6,
    badge: 'Fresh',
    stock: 120,
    featured: true,
    bestSeller: true,
    isNew: false
  },
  {
    id: 3,
    name: 'Brown Bread (Britannia)',
    category: 'Bakery',
    price: 45,
    originalPrice: 48,
    mrp: 48,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
    weight: '400 g',
    unit: '400 g',
    rating: 4.3,
    reviews: 567,
    discount: 6,
    badge: null,
    stock: 80,
    featured: false,
    bestSeller: true,
    isNew: false
  },
  {
    id: 4,
    name: 'Basmati Rice (India Gate)',
    category: 'Grains & Cereals',
    price: 299,
    originalPrice: 340,
    mrp: 340,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
    weight: '5 kg',
    unit: '5 kg',
    rating: 4.7,
    reviews: 892,
    discount: 12,
    badge: 'Premium',
    stock: 45,
    featured: true,
    bestSeller: true,
    isNew: false
  },
  {
    id: 5,
    name: 'Fresh Tomatoes',
    category: 'Fruits & Vegetables',
    price: 40,
    originalPrice: 55,
    mrp: 55,
    image: 'https://images.unsplash.com/photo-1546470427-e26264be0b0e?w=400',
    weight: '1 kg',
    unit: '1 kg',
    rating: 4.2,
    reviews: 145,
    discount: 27,
    badge: 'Fresh',
    stock: 200,
    featured: false,
    bestSeller: false,
    isNew: true
  },
  {
    id: 6,
    name: 'Greek Yogurt (Epigamia)',
    category: 'Dairy & Eggs',
    price: 85,
    originalPrice: 99,
    mrp: 99,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
    weight: '400 g',
    unit: '400 g',
    rating: 4.6,
    reviews: 312,
    discount: 14,
    badge: 'New',
    stock: 60,
    featured: true,
    bestSeller: false,
    isNew: true
  },
  {
    id: 7,
    name: 'Extra Virgin Olive Oil',
    category: 'Cooking Essentials',
    price: 699,
    originalPrice: 850,
    mrp: 850,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400',
    weight: '500 ml',
    unit: '500 ml',
    rating: 4.9,
    reviews: 456,
    discount: 18,
    badge: 'Premium',
    stock: 30,
    featured: true,
    bestSeller: false,
    isNew: false
  },
  {
    id: 8,
    name: 'Free Range Eggs (Dozen)',
    category: 'Dairy & Eggs',
    price: 120,
    originalPrice: 144,
    mrp: 144,
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',
    weight: '12 pcs',
    unit: '12 pcs',
    rating: 4.4,
    reviews: 678,
    discount: 17,
    badge: 'Farm Fresh',
    stock: 90,
    featured: false,
    bestSeller: true,
    isNew: false
  }
];

const TEST_CATEGORIES = [
  { id: 'fruits-vegetables', name: 'Fruits & Vegetables', icon: '🥦', count: 124, color: '#22c55e' },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', icon: '🥛', count: 87, color: '#f59e0b' },
  { id: 'bakery', name: 'Bakery', icon: '🍞', count: 56, color: '#f97316' },
  { id: 'grains-cereals', name: 'Grains & Cereals', icon: '🌾', count: 98, color: '#eab308' },
  { id: 'snacks-beverages', name: 'Snacks & Beverages', icon: '🧃', count: 145, color: '#ef4444' },
  { id: 'cooking-essentials', name: 'Cooking Essentials', icon: '🧄', count: 76, color: '#8b5cf6' },
  { id: 'personal-care', name: 'Personal Care', icon: '🧴', count: 89, color: '#ec4899' },
  { id: 'health-wellness', name: 'Health & Wellness', icon: '💊', count: 67, color: '#06b6d4' }
];

const TEST_COUPONS = [
  {
    code: 'FRESH10',
    discount: 10,
    type: 'percent',
    minOrder: 200,
    maxDiscount: 100,
    isActive: true,
    description: '10% OFF on orders above ₹200'
  },
  {
    code: 'NEWUSER50',
    discount: 50,
    type: 'flat',
    minOrder: 299,
    maxDiscount: 50,
    isActive: true,
    description: '₹50 OFF on orders above ₹299'
  },
  {
    code: 'SAVE20',
    discount: 20,
    type: 'percent',
    minOrder: 500,
    maxDiscount: 150,
    isActive: true,
    description: '20% OFF on orders above ₹500'
  },
  {
    code: 'MART100',
    discount: 100,
    type: 'flat',
    minOrder: 999,
    maxDiscount: 100,
    isActive: true,
    description: '₹100 OFF on orders above ₹999'
  }
];

const TEST_BANNERS = [
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
    isActive: true
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
    isActive: true
  }
];

// 4. MAIN SEED FUNCTION
async function seedEmulator() {
  console.log('====================================================');
  console.log('Mathura Quick Mart - Local Firestore Emulator Seeder');
  console.log('====================================================');

  // Verify emulator health before doing anything
  console.log(`Checking connection to emulator at ${EMULATOR_HOST}:${EMULATOR_PORT}...`);
  try {
    await checkEmulatorHealth();
    console.log(`✓ Firestore Emulator verified active at ${EMULATOR_HOST}:${EMULATOR_PORT}`);
  } catch (err) {
    console.error(`\n[ABORTED] Fail-Closed Check Failed: ${err.message}`);
    process.exit(1);
  }

  // Double-check environment variable before initializing SDK
  if (process.env.FIRESTORE_EMULATOR_HOST !== `${EMULATOR_HOST}:${EMULATOR_PORT}`) {
    console.error('\n[ABORTED] FIRESTORE_EMULATOR_HOST is not set correctly.');
    process.exit(1);
  }

  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');

  const app = getApps().length === 0
    ? initializeApp({ projectId: 'mathura-quickmart-v2' })
    : getApps()[0];

  const db = getFirestore(app);
  console.log('✓ Firebase Admin initialized targeting LOCAL EMULATOR ONLY.\n');

  // A. Seed Store Settings (Required by verifyAndPlaceOrder)
  console.log('--- 1. Store Settings ---');
  const storeRef = db.collection('settings').doc('store');
  const storeSnap = await storeRef.get();
  if (!storeSnap.exists) {
    await storeRef.set({
      isOpen: true,
      message: 'Store is open for delivery (Emulator)',
      whatsappNumber: '+919876543210',
      deliveryRadiusKm: 15,
      estimatedDeliveryTime: '30-45 mins',
      createdAt: new Date().toISOString()
    });
    console.log('  + Created settings/store: isOpen = true');
  } else {
    // Preserve existing settings; ensure isOpen is boolean true if missing
    const existing = storeSnap.data() || {};
    if (existing.isOpen === undefined) {
      await storeRef.set({ isOpen: true }, { merge: true });
      console.log('  ~ Updated settings/store: ensured isOpen = true');
    } else {
      console.log(`  = Preserved existing settings/store (isOpen = ${existing.isOpen})`);
    }
  }

  // B. Seed Order Rules (Required by verifyAndPlaceOrder)
  const orderRulesRef = db.collection('settings').doc('orderRules');
  const orderRulesSnap = await orderRulesRef.get();
  if (!orderRulesSnap.exists) {
    await orderRulesRef.set({
      minimumOrderEnabled: false,
      minimumOrderAmount: 0,
      freeDeliveryThreshold: 499,
      standardDeliveryFee: 40,
      createdAt: new Date().toISOString()
    });
    console.log('  + Created settings/orderRules: minimumOrderEnabled = false, minimumOrderAmount = 0');
  } else {
    console.log('  = Preserved existing settings/orderRules');
  }

  // C. Seed Products (Idempotent: preserves decremented stock)
  console.log('\n--- 2. Products ---');
  for (const prod of TEST_PRODUCTS) {
    const docId = String(prod.id);
    const prodRef = db.collection('products').doc(docId);
    const prodSnap = await prodRef.get();

    if (!prodSnap.exists) {
      const nowISO = new Date().toISOString();
      await prodRef.set({
        ...prod,
        createdAt: nowISO,
        updatedAt: nowISO
      });
      console.log(`  + Created product [${docId}] "${prod.name}" - Stock: ${prod.stock}, Price: ₹${prod.price}, MRP: ₹${prod.mrp}`);
    } else {
      // Idempotency: Do NOT overwrite stock if it was already updated/decremented
      const existingData = prodSnap.data() || {};
      const currentStock = typeof existingData.stock === 'number' ? existingData.stock : prod.stock;
      
      const updateData = {
        ...prod,
        stock: currentStock, // preserve existing stock
        updatedAt: new Date().toISOString()
      };
      await prodRef.set(updateData, { merge: true });
      console.log(`  = Preserved product [${docId}] "${prod.name}" - Current Stock: ${currentStock} (metadata refreshed)`);
    }
  }

  // D. Seed Categories
  console.log('\n--- 3. Categories ---');
  for (const cat of TEST_CATEGORIES) {
    const catRef = db.collection('categories').doc(cat.id);
    await catRef.set({
      ...cat,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`  ✓ Seeded category [${cat.id}] "${cat.name}"`);
  }

  // E. Seed Coupons
  console.log('\n--- 4. Coupons ---');
  for (const coupon of TEST_COUPONS) {
    const couponRef = db.collection('coupons').doc(coupon.code);
    await couponRef.set({
      ...coupon,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`  ✓ Seeded coupon [${coupon.code}] - ${coupon.description}`);
  }

  // F. Seed Banners
  console.log('\n--- 5. Banners ---');
  for (const banner of TEST_BANNERS) {
    const bannerRef = db.collection('banners').doc(banner.id);
    await bannerRef.set({
      ...banner,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`  ✓ Seeded banner [${banner.id}] "${banner.title}"`);
  }

  console.log('\n====================================================');
  console.log('✓ Seeding complete! Local Firestore emulator is ready.');
  console.log('  Target: 127.0.0.1:8080');
  console.log('====================================================');
}

// Execute if run directly
if (require.main === module) {
  seedEmulator()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n[FATAL] Error running seed script:', err);
      process.exit(1);
    });
}

module.exports = { seedEmulator, TEST_PRODUCTS, TEST_COUPONS };

