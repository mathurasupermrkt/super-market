# Mathura Quick Mart — Firebase & Firestore Health Check Report

**Date**: 2026-11-05  
**Project**: Mathura Quick Mart (`mathura-quickmart-v2`)  
**Scope**: Focused Health Check on Firebase, Firestore, Cloud Functions, and Data Architecture  

---

## 1. Executive Summary Status Table

| Area | Status | Summary |
| :--- | :---: | :--- |
| **1. Firebase Initialization & Configuration** | **NEEDS REVIEW** | SDK v10.9.0 properly exported and initialized in `js/firebase-init.js`; `firebase.json` lacks `firestore.indexes` configuration. |
| **2. Firestore Collections & Document Structures** | **PASS** | Consistent schemas across `products`, `categories`, `brands`, `orders`, `users`, `purchaseBills`, `suppliers`, `settings`. Legacy fallback (`userId` vs `customerId`) is handled safely. |
| **3. Firestore Security Rules & Permissions** | **PASS** | 45/45 rules tests passing. Strong role-based access for Admin, Delivery, and Customer. Direct order creation strictly restricted to Admin (customers must use Cloud Functions). |
| **4. Cloud Functions Auth & Validation** | **PASS** | 27/27 integration tests passing. `verifyAdminCaller`, `assignOrder`, `verifyAndPlaceOrder`, and `syncRiderLocationToOrders` enforce transaction locks, atomic stock validation, and idempotency. |
| **5. Critical Feature-to-Firestore Connections** | **PASS** | All 8 prioritized modules (Auth, Products, Inventory/POS, Orders, Delivery GPS, Settings, Suppliers, Profiles) have active, working data pipelines. |
| **6. Missing Indexes, Queries & Data Consistency** | **NEEDS REVIEW** | Missing composite index on `orders` (`userId` ASC, `createdAt` DESC) triggers client catch fallback in `index.html`. Missing composite index for driver active orders query in `functions/index.js`. |

---

## 2. Detailed Findings by Area

### Area 1: Firebase Initialization and Configuration
- **Status**: **NEEDS REVIEW**
- **Inspected Files**:
  - `js/firebase-init.js`: Fully functional. Initializes modular Firebase v10.9.0 and attaches required services (`FirebaseApp`, `FirebaseDB`, `Firestore`, `FirebaseAuth`, `FirebaseStorage`, `FirebaseFunctions`) to `window`. Dispatches `firebase-ready` event.
  - `js/firebase.js`: Properly marked as an alias stub redirecting to `js/firebase-init.js`.
  - `.firebaserc`: Targets `mathura-quickmart-v2`.
- **Identified Deficiency**:
  - **File**: `firebase.json`
  - **Cause**: Does not include a `"indexes": "firestore.indexes.json"` entry under the `"firestore"` configuration block, meaning Firestore composite indexes are not version-controlled or deployable via Firebase CLI.

---

### Area 2: Firestore Collections and Document Structures
- **Status**: **PASS**
- **Inspected Schemas**:
  - `products`: Enforces numeric `price`, `stock`, `mrp`, and string `name`, `category`, `brand`.
  - `orders`: Authoritative backend schema created by `verifyAndPlaceOrder` contains `id`, `userId`, `items` (with authoritative prices), `subtotal`, `deliveryFee`, `total`, `status`, `customerLocation`, and `driverLocation`.
  - `users`: Separate roles (`customer`, `admin`, `delivery`). Delivery users require `approvalStatus == 'approved'`. Subcollections `cart`, `wishlist`, `returns` isolated per user.
  - `purchaseBills` & `suppliers`: Atomic records with bill metadata, line items, and audit timestamps.
- **Data Consistency**:
  - Purchase POS consolidated items logic ensures no duplicate document reference updates occur within a single transaction.

---

### Area 3: Firestore Security Rules and User-Role Permissions
- **Status**: **PASS**
- **Test Results**: 45/45 security rules tests passing (`tests/firestore.rules.test.js`).
- **Key Verifications**:
  - **Orders Protection**: Client-side direct order creation is completely disabled (`allow create: if isAdmin()`), forcing checkout through backend validation.
  - **Delivery Partner Privacy**: The `deliveryPartners` telemetry collection is restricted to rider owners and admins. Customers can only read rider coordinates via their specific assigned `orders/{orderId}.driverLocation`.
  - **Privilege Escalation Prevention**: User update rules prevent self-granting `role` or `approvalStatus`.

---

### Area 4: Cloud Functions Authentication and Validation
- **Status**: **PASS**
- **Test Results**: 27/27 integration tests passing (`tests/functions.integration.test.js`).
- **Key Verifications**:
  - `verifyAdminCaller`: Master UID (`7SBL73wlj7OxKBsMExoJNhdrDTU2`), verified email (`mathurasupermrkt@gmail.com`), or verified DB role `admin`. Rejects spoofed emails and unauthenticated requests.
  - `verifyAndPlaceOrder`: Atomic transaction verification: recalculates prices against Firestore `products`, checks store status (`settings/store`), checks minimum order (`settings/orderRules`), checks and decrements inventory, and enforces idempotency with `clientOrderId`.
  - `assignOrder`: Admin-only verification, prevents double driver assignment, verifies rider approval status, and clears old rider allocations upon reassignment.
  - `syncRiderLocationToOrders`: Validates latitude/longitude bounds ($-90 \le \text{lat} \le 90$, $-180 \le \text{lng} \le 180$), validates timestamp parsing, ignores stale or out-of-order packets, and updates only active orders (`assigned`, `processing`, `packed`, `out-delivery`).

---

### Area 5: Critical Feature-to-Firestore Connections
- **Status**: **PASS**
- **Feature Breakdown**:
  1. **Authentication**: **PASS** — Integrated via `FirebaseAuth` in `js/firebase-init.js`; profile synchronization with `/users/{uid}`.
  2. **Products & Categories**: **PASS** — Real-time and snapshot retrieval across catalog, search, and admin dashboards.
  3. **Inventory & Purchase POS**: **PASS** — Dynamic categories and brands loading; atomic transaction handles stock increment and bill creation (12/12 unit tests passing).
  4. **Orders & Checkout**: **PASS** — Checkout routes through callable Cloud Function `verifyAndPlaceOrder`, preventing client price tampering.
  5. **Delivery Partners & GPS**: **PASS** — `delivery/partner.html` updates telemetry; Cloud Function triggers real-time updates onto order documents for customer tracking.
  6. **Store Settings**: **PASS** — `settings/store` and `settings/orderRules` read by client and verified by backend.
  7. **Suppliers & Purchase Bills**: **PASS** — Admin POS correctly reads suppliers and writes itemized bills.
  8. **Customers & Profiles**: **PASS** — Profiles, addresses, and user-scoped subcollections (`cart`, `wishlist`, `returns`) are fully connected.

---

### Area 6: Missing Indexes, Failed Queries and Data Consistency
- **Status**: **NEEDS REVIEW**
- **Identified Query Issues**:
  1. **Issue 1: Missing Composite Index on Orders (`userId` ASC, `createdAt` DESC)**
     - **File**: `index.html` (Lines 2561–2578)
     - **Function / Context**: Customer order history lookup (`fs.query(fs.collection(db, 'orders'), fs.where('userId', '==', user.uid), fs.orderBy('createdAt', 'desc'), fs.limit(15))`)
     - **Suspected Cause**: Equality filter on `userId` paired with `orderBy('createdAt', 'desc')` requires a composite index in Firestore. The code contains an inline try/catch fallback: `// Fallback: try without orderBy (index may not exist)`, indicating the query throws index errors in production if the index was not manually created in the Firebase Console.
  2. **Issue 2: Missing Composite Index for Driver Telemetry Query**
     - **File**: `functions/index.js` (Lines 433–436)
     - **Function**: `syncRiderLocationToOrdersHandler`
     - **Suspected Cause**: Query filters on `driverId == partnerId` AND `status in ['assigned', 'processing', 'packed', 'out-delivery']`. An equality clause combined with an `in` operator on a separate field in Firestore benefits from a composite index (`driverId` ASC, `status` ASC) for optimal latency.
  3. **Issue 3: Missing `firestore.indexes.json` File**
     - **File**: Root workspace
     - **Suspected Cause**: Neither `firebase.json` nor the repository defines composite indexes in a `firestore.indexes.json` file.

---

## 3. Summary of Items Requiring Action (Review Only)

| Issue | File | Function / Section | Suspected Cause |
| :--- | :--- | :--- | :--- |
| **Missing index config** | `firebase.json` | Top level config | Missing `"indexes": "firestore.indexes.json"` property |
| **Missing composite index** | `firestore.indexes.json` (Missing file) | `orders` collection | `userId` (ASC) + `createdAt` (DESC) needed for ordered order history query |
| **Missing composite index** | `firestore.indexes.json` (Missing file) | `orders` collection | `driverId` (ASC) + `status` (ASC) for driver active order lookups |
| **Query fallback catch** | `index.html` | L2561–2578 | Fallback to unordered query hides missing composite index in production |

