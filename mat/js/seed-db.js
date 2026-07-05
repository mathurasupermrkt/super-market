/**
 * One-time script to seed the Firestore database with the mock data from app.js.
 * This runs automatically if included in an HTML file, or you can call seedDatabase() manually.
 */

async function seedDatabase() {
  if (!window.FirebaseDB || !window.Firestore) {
    console.error("Firebase is not initialized yet. Cannot seed database.");
    return;
  }

  const { doc, setDoc, collection, getDocs } = window.Firestore;
  const db = window.FirebaseDB;

  try {
    console.log("Checking if products collection is empty...");
    const productsSnapshot = await getDocs(collection(db, 'products'));
    
    if (!productsSnapshot.empty) {
      console.log(`Database already has ${productsSnapshot.size} products. Skipping seed.`);
      return;
    }

    console.log("Seeding products...");
    for (const product of API.products) {
      // Use the product ID as the document ID for consistency
      await setDoc(doc(db, 'products', product.id.toString()), product);
      console.log(`Added product: ${product.name}`);
    }

    console.log("Seeding categories...");
    for (const category of API.categories) {
      await setDoc(doc(db, 'categories', category.name), category);
      console.log(`Added category: ${category.name}`);
    }

    console.log("Seeding coupons...");
    for (const coupon of API.coupons) {
      await setDoc(doc(db, 'coupons', coupon.code), coupon);
      console.log(`Added coupon: ${coupon.code}`);
    }
    
    console.log("✅ Database seeded successfully!");
    if (window.API && typeof window.API.syncFromFirestore === 'function') {
      await window.API.syncFromFirestore();
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Attach to window so it can be called from the console
window.seedDatabase = seedDatabase;
