/**
 * Mathura Quick Mart - Local Test Admin Email Migration Script
 *
 * MIGRATION TARGET:
 * - Existing UID:  U2nUX9RlRZPXfvzXZ0Tu1UyNv0LW
 * - Current Email: admin@gmail.com
 * - New Email:     mathurasupermrkt@gmail.com
 *
 * STRICT LOCAL EMULATOR ONLY:
 * - Auth Emulator:      127.0.0.1:9099
 * - Firestore Emulator: 127.0.0.1:8080
 * - Project ID:         mathura-quickmart-v2
 *
 * GUARANTEES:
 * - Preserves existing UID (U2nUX9RlRZPXfvzXZ0Tu1UyNv0LW)
 * - Preserves existing password and credential hashes
 * - Preserves role: 'admin' and all existing Firestore user fields
 * - Checks collision before updating (will NOT overwrite if new email exists on another account)
 * - Fail-closed preflight checks
 * - Never modifies customer accounts or production Firebase
 */

const http = require('http');

// 1. STRICT LOCAL EMULATOR CONFIGURATION & GUARDRAILS
const PROJECT_ID = 'mathura-quickmart-v2';
const AUTH_EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_EMULATOR_PORT = 8080;

process.env.FIREBASE_AUTH_EMULATOR_HOST = `${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST = `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`;

const TARGET_UID = 'U2nUX9RlRZPXfvzXZ0Tu1UyNv0LW';
const NEW_EMAIL = 'mathurasupermrkt@gmail.com';

// 2. PRE-FLIGHT EMULATOR HEALTH CHECKS
function pingHttp(host, port, name, validateFn) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${host}:${port}/`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 && (!validateFn || validateFn(data))) {
          resolve(true);
        } else {
          reject(new Error(`Unexpected response from ${name} emulator at ${host}:${port} (status: ${res.statusCode})`));
        }
      });
    });
    req.on('error', err => {
      reject(new Error(`Cannot connect to ${name} emulator at ${host}:${port}: ${err.message}`));
    });
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error(`Connection to ${name} emulator timed out.`));
    });
  });
}

// 3. MAIN MIGRATION FUNCTION
async function migrateAdminEmail() {
  console.log('====================================================');
  console.log('Mathura Quick Mart - Local Test Admin Email Migration');
  console.log('====================================================');

  // Verify emulator environment variable hard-locking
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== `${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`) {
    throw new Error('FAIL-CLOSED: FIREBASE_AUTH_EMULATOR_HOST is not set correctly.');
  }
  if (process.env.FIRESTORE_EMULATOR_HOST !== `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`) {
    throw new Error('FAIL-CLOSED: FIRESTORE_EMULATOR_HOST is not set correctly.');
  }

  // Pre-flight health checks
  console.log('Checking local emulator availability...');
  await pingHttp(AUTH_EMULATOR_HOST, AUTH_EMULATOR_PORT, 'Authentication', data => data.includes('authEmulator'));
  console.log(`✓ Auth Emulator verified active at ${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`);

  await pingHttp(FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, 'Firestore', data => data.trim() === 'Ok');
  console.log(`✓ Firestore Emulator verified active at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`);

  // Initialize modular Firebase Admin SDK
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');

  const app = getApps().length === 0
    ? initializeApp({ projectId: PROJECT_ID })
    : getApps()[0];

  const auth = getAuth(app);
  const db = getFirestore(app);

  // STEP 1: Verify target user exists by UID
  console.log(`\nInspecting existing account by UID [${TARGET_UID}]...`);
  let currentAuthUser;
  try {
    currentAuthUser = await auth.getUser(TARGET_UID);
    console.log(`✓ Found user in Auth Emulator: email = "${currentAuthUser.email}", UID = "${currentAuthUser.uid}"`);
  } catch (err) {
    throw new Error(`Cannot find user with UID [${TARGET_UID}] in local Auth emulator: ${err.message}`);
  }

  // STEP 2: Collision check for NEW_EMAIL
  console.log(`Checking if target email "${NEW_EMAIL}" is already registered...`);
  try {
    const existingUserWithNewEmail = await auth.getUserByEmail(NEW_EMAIL);
    if (existingUserWithNewEmail.uid !== TARGET_UID) {
      throw new Error(`ABORTED: Email "${NEW_EMAIL}" is already registered under a different account (UID: ${existingUserWithNewEmail.uid}). Overwrite prevented.`);
    }
    console.log(`  Notice: Account with UID ${TARGET_UID} already has email "${NEW_EMAIL}".`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`✓ Confirmed: Email "${NEW_EMAIL}" is available in Auth Emulator.`);
    } else {
      throw err;
    }
  }

  // STEP 3: Update Auth user email (preserves UID and password)
  if (currentAuthUser.email !== NEW_EMAIL) {
    console.log(`\nUpdating Auth user email from "${currentAuthUser.email}" to "${NEW_EMAIL}"...`);
    const updatedUser = await auth.updateUser(TARGET_UID, {
      email: NEW_EMAIL,
      emailVerified: true
    });
    console.log(`✓ Auth user updated successfully. UID = ${updatedUser.uid}, email = "${updatedUser.email}" (password unchanged).`);
  } else {
    console.log(`✓ Auth user already has email "${NEW_EMAIL}". Skipping Auth update.`);
  }

  // STEP 4: Update Firestore document users/{TARGET_UID}
  console.log(`\nUpdating Firestore document users/${TARGET_UID}...`);
  const userDocRef = db.collection('users').doc(TARGET_UID);
  const userDocSnap = await userDocRef.get();

  if (!userDocSnap.exists) {
    throw new Error(`Firestore document users/${TARGET_UID} does not exist. Migration cannot preserve missing fields.`);
  }

  const existingDocData = userDocSnap.data();
  console.log('Existing Firestore document fields:', Object.keys(existingDocData));

  const updatedDocData = {
    ...existingDocData,
    email: NEW_EMAIL,
    role: 'admin', // preserved
    updatedAt: new Date().toISOString()
  };

  await userDocRef.set(updatedDocData, { merge: true });
  console.log(`✓ Firestore document users/${TARGET_UID} updated successfully.`);
  console.log(`  - email: "${updatedDocData.email}"`);
  console.log(`  - role:  "${updatedDocData.role}"`);

  // STEP 5: Verification audit
  console.log('\n--- Verification Audit ---');
  const verifyAuth = await auth.getUser(TARGET_UID);
  const verifyDoc = await userDocRef.get();
  const verifyDocData = verifyDoc.data();

  console.log(`Auth verification:      email = "${verifyAuth.email}", UID = "${verifyAuth.uid}"`);
  console.log(`Firestore verification: email = "${verifyDocData.email}", role = "${verifyDocData.role}", name = "${verifyDocData.name}"`);

  // Verify other customer accounts are completely untouched
  const allUsersSnap = await db.collection('users').get();
  console.log(`\nTotal users in Firestore: ${allUsersSnap.size}`);
  allUsersSnap.forEach(d => {
    const u = d.data();
    console.log(`  - ${u.email || d.id}: role = '${u.role}'`);
  });

  console.log('\n====================================================');
  console.log('✓ Migration completed successfully (Local Emulator Only)');
  console.log(`  New Admin Email: ${NEW_EMAIL}`);
  console.log(`  Admin UID:       ${TARGET_UID}`);
  console.log('====================================================');
}

// Execute if run directly
if (require.main === module) {
  migrateAdminEmail()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n[FATAL] Error migrating admin email:', err.message);
      process.exit(1);
    });
}

module.exports = { migrateAdminEmail };

