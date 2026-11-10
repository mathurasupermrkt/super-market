
import { readFile } from "node:fs/promises";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = "demo-mathura-quickmart";

let testEnv;

// Authenticated test user with an email claim.
function userContext(uid) {
  return testEnv.authenticatedContext(uid, {
    email: `${uid}@example.test`,
  });
}

// --------------------------------------------------
// TEST SETUP
// --------------------------------------------------

before(async () => {
  const rules = await readFile("firestore.rules", "utf8");

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed test data without applying security rules.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Users
    await setDoc(doc(db, "users/customer1"), {
      role: "customer",
    });

    await setDoc(doc(db, "users/customer2"), {
      role: "customer",
    });

    await setDoc(doc(db, "users/driver1"), {
      role: "delivery",
      approvalStatus: "approved",
    });

    await setDoc(doc(db, "users/pendingDriver"), {
      role: "delivery",
      approvalStatus: "pending",
    });

    await setDoc(doc(db, "users/admin1"), {
      role: "admin",
    });

    // Orders
    await setDoc(doc(db, "orders/order1"), {
      userId: "customer1",
      total: 250,
      status: "pending",
      driverId: null,
      deliveryRequestStatus: "pending",
      declinedDrivers: [],
    });

    await setDoc(doc(db, "orders/order2"), {
      userId: "customer2",
      total: 400,
      status: "assigned",
      driverId: "driver1",
      driverName: "Test Driver",
      deliveryRequestStatus: "accepted",
      declinedDrivers: [],
    });

    // Cart items
    await setDoc(
      doc(db, "users/customer1/cart/product1"),
      {
        productId: "product1",
        quantity: 2,
      }
    );

    await setDoc(
      doc(db, "users/customer2/cart/product2"),
      {
        productId: "product2",
        quantity: 1,
      }
    );

    // Wishlist items
    await setDoc(
      doc(db, "users/customer1/wishlist/product1"),
      {
        productId: "product1",
      }
    );

    await setDoc(
      doc(db, "users/customer2/wishlist/product2"),
      {
        productId: "product2",
      }
    );

    // Delivery partner data
    await setDoc(doc(db, "deliveryPartners/driver1"), {
      name: "Test Driver",
      status: "Available",
    });
  });
});

// --------------------------------------------------
// 1. CUSTOMER PROFILE SECURITY
// --------------------------------------------------

test("customer can read their own profile", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "users/customer1"))
  );
});

test("customer cannot read another customer's profile", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    getDoc(doc(db, "users/customer2"))
  );
});

test("unauthenticated user cannot read a private profile", async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(
    getDoc(doc(db, "users/customer1"))
  );
});

// --------------------------------------------------
// 2. ORDER READ SECURITY
// --------------------------------------------------

test("customer can read their own order", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "orders/order1"))
  );
});

test("customer cannot read another customer's order", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    getDoc(doc(db, "orders/order2"))
  );
});

// --------------------------------------------------
// 3. CUSTOMER ORDER CREATION
// --------------------------------------------------

test("customer cannot create an order directly in Firestore", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/newOrder"), {
      userId: "customer1",
      total: 150,
      status: "pending",
      driverId: null,
    })
  );
});

test("admin can create an order directly in Firestore", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    setDoc(doc(db, "orders/adminCreatedOrder"), {
      userId: "customer1",
      total: 150,
      status: "pending",
      driverId: null,
    })
  );
});

test("customer cannot create an order for another user", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/invalidOrder"), {
      userId: "customer2",
      total: 150,
      status: "pending",
      driverId: null,
    })
  );
});

// --------------------------------------------------
// 4. ORDER TOTAL PROTECTION
// --------------------------------------------------

test("customer cannot change the order total", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      total: 1,
    })
  );
});

// --------------------------------------------------
// --------------------------------------------------
// 5. DELIVERY PARTNER ASSIGNMENT RESTRICTION
// --------------------------------------------------

test("delivery partner cannot directly accept or self-assign an unassigned order", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      driverId: "driver1",
      driverName: "Test Driver",
      deliveryRequestStatus: "accepted",
      status: "assigned",
    })
  );
});

// --------------------------------------------------
// 6. DELIVERY STATUS TRANSITIONS
// --------------------------------------------------

test("delivery partner cannot directly mark an assigned order delivered", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order2"), {
      status: "delivered",
      updatedAt: "test-time",
    })
  );
});

test("delivery partner can move their assigned order to out-delivery", async () => {
  const db = userContext("driver1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "orders/order2"), {
      status: "out-delivery",
      updatedAt: "test-time",
    })
  );
});

test("delivery partner can mark their out-delivery order delivered", async () => {
  const db = userContext("driver1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "orders/order2"), {
      status: "out-delivery",
      updatedAt: "test-time",
    })
  );

  await assertSucceeds(
    updateDoc(doc(db, "orders/order2"), {
      status: "delivered",
      updatedAt: "test-time",
    })
  );
});

test("delivery partner cannot change another driver's order", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      status: "out-delivery",
      updatedAt: "test-time",
    })
  );
});

// --------------------------------------------------
// 7. CUSTOMER CANCELLATION
// --------------------------------------------------

test("customer can cancel their own pending order", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "orders/order1"), {
      status: "cancelled",
      updatedAt: "test-time",
    })
  );
});

test("customer cannot cancel another customer's order", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order2"), {
      status: "cancelled",
      updatedAt: "test-time",
    })
  );
});

// --------------------------------------------------
// --------------------------------------------------
// 8. DELIVERY REQUEST DECLINE RESTRICTION
// --------------------------------------------------

test("delivery partner cannot modify an unassigned order to decline it", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      declinedDrivers: ["driver1"],
    })
  );
});

test("delivery partner cannot change order total while declining", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      declinedDrivers: ["driver1"],
      total: 1,
    })
  );
});

// --------------------------------------------------
// 9. ADMIN PERMISSIONS
// --------------------------------------------------

test("admin can read another customer's order", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "orders/order2"))
  );
});

test("admin can update an order", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "orders/order1"), {
      status: "confirmed",
    })
  );
});

test("untrusted user with admin@ prefix cannot update order", async () => {
  const db = testEnv.authenticatedContext("fakeAdmin", {
    email: "admin@attacker.test",
    email_verified: true,
  }).firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      status: "confirmed",
    })
  );
});

test("unverified admin email cannot update order", async () => {
  const db = testEnv.authenticatedContext("unverifiedAdmin", {
    email: "mathurasupermrkt@gmail.com",
    email_verified: false,
  }).firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order1"), {
      status: "confirmed",
    })
  );
});

// --------------------------------------------------
// 10. STORE-CLOSED RESTRICTION
// --------------------------------------------------

test("customer cannot create an order when the store is closed", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "settings/store"),
      { isOpen: false }
    );
  });

  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/closedStoreOrder"), {
      userId: "customer1",
      total: 200,
      status: "pending",
      driverId: null,
    })
  );
});

// --------------------------------------------------
// 10B. MINIMUM ORDER AMOUNT RESTRICTION
// --------------------------------------------------

test("customer cannot create an order below minimum order amount when enabled", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "settings/orderRules"),
      {
        minimumOrderAmount: 299,
        minimumOrderEnabled: true
      }
    );
  });

  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/belowMinOrder"), {
      userId: "customer1",
      subtotal: 199,
      total: 199,
      status: "pending",
      driverId: null,
    })
  );
});

test("customer cannot create an order directly even with amount meeting minimum", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "settings/orderRules"),
      {
        minimumOrderAmount: 299,
        minimumOrderEnabled: true
      }
    );
  });

  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/validMinOrder"), {
      userId: "customer1",
      subtotal: 299,
      total: 299,
      status: "pending",
      driverId: null,
    })
  );
});

test("customer cannot create an order directly when minimum order is disabled", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "settings/orderRules"),
      {
        minimumOrderAmount: 299,
        minimumOrderEnabled: false
      }
    );
  });

  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "orders/disabledMinOrder"), {
      userId: "customer1",
      subtotal: 150,
      total: 150,
      status: "pending",
      driverId: null,
    })
  );
});

test("non-admin customer cannot update order rules setting", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    setDoc(doc(db, "settings/orderRules"), {
      minimumOrderAmount: 50,
      minimumOrderEnabled: true
    })
  );
});

test("admin can update order rules setting", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    setDoc(doc(db, "settings/orderRules"), {
      minimumOrderAmount: 399,
      minimumOrderEnabled: true
    })
  );
});

// --------------------------------------------------
// 11. CART SECURITY
// --------------------------------------------------

test("customer can read their own cart item", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "users/customer1/cart/product1"))
  );
});

test("customer can add an item to their own cart", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    setDoc(doc(db, "users/customer1/cart/product3"), {
      id: "product3",
      name: "Fresh Bread",
      price: 45,
      qty: 1,
    })
  );
});

test("customer cannot read another customer's cart item", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    getDoc(doc(db, "users/customer2/cart/product2"))
  );
});

// --------------------------------------------------
// 12. WISHLIST SECURITY
// --------------------------------------------------

test("customer can read their own wishlist item", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "users/customer1/wishlist/product1"))
  );
});

test("customer can add an item to their own wishlist", async () => {
  const db = userContext("customer1").firestore();

  await assertSucceeds(
    setDoc(doc(db, "users/customer1/wishlist/product3"), {
      productId: "product3",
    })
  );
});

test("customer cannot read another customer's wishlist item", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    getDoc(doc(db, "users/customer2/wishlist/product2"))
  );
});

// --------------------------------------------------
// 13. DELIVERY PARTNER DATA SECURITY
// --------------------------------------------------

test("delivery partner can read their own partner data", async () => {
  const db = userContext("driver1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "deliveryPartners/driver1"))
  );
});

test("admin can read delivery partner data", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    getDoc(doc(db, "deliveryPartners/driver1"))
  );
});

test("customer cannot read delivery partner data", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    getDoc(doc(db, "deliveryPartners/driver1"))
  );
});

test("unauthenticated user cannot read delivery partner data", async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(
    getDoc(doc(db, "deliveryPartners/driver1"))
  );
});

test("delivery partner can update their own data", async () => {
  const db = userContext("driver1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "deliveryPartners/driver1"), {
      status: "Offline",
    })
  );
});

test("customer cannot update another user's delivery partner data", async () => {
  const db = userContext("customer1").firestore();

  await assertFails(
    updateDoc(doc(db, "deliveryPartners/driver1"), {
      status: "Offline",
    })
  );
});

test("admin can update delivery partner data", async () => {
  const db = userContext("admin1").firestore();

  await assertSucceeds(
    updateDoc(doc(db, "deliveryPartners/driver1"), {
      status: "Offline",
    })
  );
});

// --------------------------------------------------
// 14. PENDING RIDER & UNASSIGNED ORDER SECURITY
// --------------------------------------------------

test("pending delivery applicant cannot perform delivery operations", async () => {
  const db = userContext("pendingDriver").firestore();

  await assertFails(
    getDoc(doc(db, "orders/order2"))
  );

  await assertFails(
    updateDoc(doc(db, "orders/order2"), {
      status: "out-delivery",
      updatedAt: "test-time",
    })
  );
});

test("pending delivery applicant cannot update telemetry", async () => {
  const db = userContext("pendingDriver").firestore();

  await assertFails(
    setDoc(doc(db, "deliveryPartners/pendingDriver"), {
      name: "Pending Driver",
      status: "Available",
    })
  );
});

test("approved delivery partner cannot read unassigned orders", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    getDoc(doc(db, "orders/order1"))
  );
});

test("delivery partner cannot modify protected fields on assigned orders", async () => {
  const db = userContext("driver1").firestore();

  await assertFails(
    updateDoc(doc(db, "orders/order2"), {
      total: 10,
      updatedAt: "test-time",
    })
  );

  await assertFails(
    updateDoc(doc(db, "orders/order2"), {
      userId: "hacked-user",
      updatedAt: "test-time",
    })
  );
});

