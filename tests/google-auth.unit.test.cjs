/**
 * Unit Test: Google Authentication Configuration & Environment Separation
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('1. Firebase Config uses production mathura-quickmart-v2 authDomain', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /projectId:\s*["']mathura-quickmart-v2["']/, 'Project ID is mathura-quickmart-v2');
  assert.match(content, /authDomain:\s*["']mathura-quickmart-v2\.firebaseapp\.com["']/, 'authDomain is mathura-quickmart-v2.firebaseapp.com');
});

test('2. Firebase Init exports GoogleAuthProvider, signInWithPopup, and signInWithRedirect', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /GoogleAuthProvider/, 'GoogleAuthProvider imported and exposed');
  assert.match(content, /signInWithPopup/, 'signInWithPopup imported and exposed');
  assert.match(content, /signInWithRedirect/, 'signInWithRedirect imported and exposed');
  assert.match(content, /getRedirectResult/, 'getRedirectResult imported and exposed');
});

test('3. Environment Separation: Local dev defaults to Real Live Firebase; Emulators are opt-in only', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /isExplicitEmulatorRequested/, 'Checks explicit request for emulator mode');
  assert.match(content, /window\.__USE_FIREBASE_EMULATORS__ === true/, 'Allows explicit window flag for emulator testing');
  assert.match(content, /\[Live Firebase Mode\]/, 'Logs live Firebase mode by default');
});

test('4. customer/login.html: Configures Google provider with prompt select_account', () => {
  const content = fs.readFileSync('customer/login.html', 'utf8');
  assert.match(content, /prompt:\s*['"]select_account['"]/, 'Ensures account picker is always presented');
  assert.match(content, /provider\.addScope\(['"]email['"]\)/, 'Requests email scope');
  assert.match(content, /provider\.addScope\(['"]profile['"]\)/, 'Requests profile scope');
});

test('5. customer/login.html: New Google users receive role "customer" strictly', () => {
  const content = fs.readFileSync('customer/login.html', 'utf8');
  assert.match(content, /role:\s*['"]customer['"]/, 'Strictly assigns customer role to new user profile');
});

test('6. customer/login.html: Preserves existing role when Google user profile exists', () => {
  const content = fs.readFileSync('customer/login.html', 'utf8');
  assert.match(content, /role\s*=\s*data\.role\s*\|\|\s*['"]customer['"]/, 'Preserves existing user role');
});

test('7. customer/login.html & customer/register.html: Comprehensive error handling for popup and domains', () => {
  const loginContent = fs.readFileSync('customer/login.html', 'utf8');
  const regContent = fs.readFileSync('customer/register.html', 'utf8');

  for (const content of [loginContent, regContent]) {
    assert.match(content, /auth\/popup-closed-by-user/, 'Handles popup closed gracefully');
    assert.match(content, /auth\/popup-blocked/, 'Handles popup blocked with redirect fallback');
    assert.match(content, /auth\/unauthorized-domain/, 'Guides user on unauthorized domain configuration');
    assert.match(content, /auth\/account-exists-with-different-credential/, 'Handles credential collision');
  }
});

