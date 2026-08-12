/**
 * One-time script to seed the Firestore database with the mock data from app.js.
 * Skips automatically if the database has already been seeded.
 */

async function seedDatabase(force = false) {
  if (!window.FirebaseDB || !window.Firestore) {
    console.error("Firebase is not initialized yet. Cannot seed database.");
    return;
  }

  // Fast check: Skip if already seeded in this browser session
  if (!force && localStorage.getItem('mathura_db_seeded') === 'true') {
    console.log("⚡ Database already seeded (cached). Skipping automatic re-seed.");
    return;
  }

  const { doc, setDoc, collection, getDocs } = window.Firestore;
  const db = window.FirebaseDB;

  try {
    // Check if Firestore already has products — avoid overwriting existing data
    if (!force) {
      const snap = await getDocs(collection(db, 'products'));
      if (!snap.empty) {
        console.log("⚡ Firestore already contains product data. Skipping auto-seed.");
        localStorage.setItem('mathura_db_seeded', 'true');
        return;
      }
    }

    console.log("🌱 Seeding database in parallel...");
    const t0 = performance.now();
    const writeOps = [];

    // Seed products in parallel
    for (const product of API.products) {
      writeOps.push(setDoc(doc(db, 'products', product.id.toString()), product));
    }

    // Seed categories in parallel
    for (const category of API.categories) {
      writeOps.push(setDoc(doc(db, 'categories', category.name), category));
    }

    // Seed coupons in parallel
    for (const coupon of API.coupons) {
      writeOps.push(setDoc(doc(db, 'coupons', coupon.code), coupon));
    }

    // Seed primary admin profile
    const adminUid = 'KVai9GaRYDfxRHdzledvvwIK7La2';
    writeOps.push(setDoc(doc(db, 'users', adminUid), {
      uid: adminUid,
      name: "Admin Manager",
      email: "vikramsenthilkumar164@gmail.com",
      role: "admin",
      createdAt: new Date().toISOString()
    }, { merge: true }));

    await Promise.all(writeOps);
    localStorage.setItem('mathura_db_seeded', 'true');
    console.log(`✅ Database seeded successfully in ${Math.round(performance.now() - t0)}ms!`);

    if (window.API && typeof window.API.syncFromFirestore === 'function') {
      await window.API.syncFromFirestore();
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Seed admin profile
async function seedAdminProfile(uid) {
  uid = uid || 'KVai9GaRYDfxRHdzledvvwIK7La2';
  if (!window.FirebaseDB || !window.Firestore) {
    console.error("Firebase is not initialized yet.");
    return;
  }

  const { doc, setDoc } = window.Firestore;
  const db = window.FirebaseDB;

  try {
    console.log(`Seeding admin role for UID: ${uid}...`);
    await setDoc(doc(db, 'users', uid), {
      uid: uid,
      name: "Admin Manager",
      email: "vikramsenthilkumar164@gmail.com",
      role: "admin",
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log("✅ Admin profile seeded successfully in Firestore users collection!");
  } catch (error) {
    console.error("Error seeding admin profile:", error);
  }
}

// Attach to window so it can be called from the console
window.seedDatabase = seedDatabase;
window.seedAdminProfile = seedAdminProfile;
