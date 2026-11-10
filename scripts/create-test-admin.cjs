/**
 * Mathura Quick Mart - Local Test Admin Account Creation Script
 *
 * STRICT LOCAL EMULATOR ONLY:
 * - Targets Auth Emulator at 127.0.0.1:9099
 * - Targets Firestore Emulator at 127.0.0.1:8080
 * - Project ID: mathura-quickmart-v2
 * - Safe & idempotent: Reuses existing UID if admin@gmail.com already exists
 * - Never modifies existing customer accounts or production Firebase
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

const TARGET_ADMIN_EMAIL = 'mathurasupermrkt@gmail.com';

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

// 3. SECURE MASKED TERMINAL PASSWORD INPUT
function getPasswordSecurely() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error('Terminal is not interactive (TTY required for masked password input).'));
    }

    process.stdout.write('Enter local test admin password (min 6 characters): ');
    let password = '';

    // Put stdin in raw mode so keypresses are read character-by-character without terminal echo
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function cleanup() {
      try {
        process.stdin.setRawMode(false);
      } catch (_) {}
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    }

    function onData(chunk) {
      for (const char of chunk) {
        // Ctrl+C (SIGINT, \u0003) or Ctrl+D (EOT, \u0004)
        if (char === '\u0003' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          return reject(new Error('Password entry cancelled by user (SIGINT).'));
        }

        // Enter or Return (\r, \n)
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          if (password.length < 6) {
            return reject(new Error('Password must be at least 6 characters long.'));
          }
          return resolve(password);
        }

        // Backspace (\u0008, \u007f, \b)
        if (char === '\u0008' || char === '\u007f' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char !== '\u007f') {
          // Printable ASCII character
          password += char;
          process.stdout.write('*');
        }
      }
    }

    process.stdin.on('data', onData);
  });
}

// 4. MAIN CREATION LOGIC
async function createTestAdmin() {
  console.log('====================================================');
  console.log('Mathura Quick Mart - Local Test Admin Provisioner');
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

  console.log(`\nChecking local test admin account: ${TARGET_ADMIN_EMAIL}...`);

  // Step A: Check if Auth user already exists (Idempotent reuse without changing credentials)
  let userRecord;
  let isExisting = false;
  try {
    userRecord = await auth.getUserByEmail(TARGET_ADMIN_EMAIL);
    isExisting = true;
    console.log(`  = Found existing Auth user: UID = ${userRecord.uid}`);
    console.log(`  = Preserved existing credentials (password will not be modified)`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`  * Account ${TARGET_ADMIN_EMAIL} does not exist in Auth emulator.`);
      const password = await getPasswordSecurely();
      userRecord = await auth.createUser({
        email: TARGET_ADMIN_EMAIL,
        password: password,
        displayName: 'Store Admin',
        emailVerified: true
      });
      console.log(`  + Created new Auth user: UID = ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  // Step B: Ensure Firestore document users/{uid} has role = 'admin'
  const userDocRef = db.collection('users').doc(userRecord.uid);
  const nowISO = new Date().toISOString();
  
  await userDocRef.set({
    uid: userRecord.uid,
    email: TARGET_ADMIN_EMAIL,
    name: userRecord.displayName || 'Store Admin',
    role: 'admin',
    approvalStatus: 'approved',
    updatedAt: nowISO,
    ...(isExisting ? {} : { createdAt: nowISO })
  }, { merge: true });

  console.log(`  ✓ Synced Firestore document users/${userRecord.uid} with role: 'admin'`);

  // Step C: Verify existing customer accounts were untouched
  const allUsersSnap = await db.collection('users').get();
  console.log(`\nVerification: Total Firestore users = ${allUsersSnap.size}`);
  allUsersSnap.forEach(d => {
    const u = d.data();
    console.log(`  - ${u.email || d.id}: role = '${u.role}'`);
  });

  console.log('\n====================================================');
  console.log('✓ Success! Local test admin account is ready for login.');
  console.log(`  Portal:      http://127.0.0.1:5500/admin/login.html`);
  console.log(`  Email ID:    ${TARGET_ADMIN_EMAIL}`);
  console.log(`  Target Auth: http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`);
  console.log('====================================================');
}

// Execute if run directly
if (require.main === module) {
  createTestAdmin()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n[FATAL] Error creating test admin:', err.message);
      process.exit(1);
    });
}

module.exports = { createTestAdmin };

