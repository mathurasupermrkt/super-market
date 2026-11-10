import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('firebase.json: Emulators are configured with exact ports and isolation flags', () => {
  const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  assert.ok(config.emulators, 'Emulators block exists');
  assert.equal(config.emulators.auth?.port, 9099, 'Auth emulator on port 9099');
  assert.equal(config.emulators.functions?.port, 5001, 'Functions emulator on port 5001');
  assert.equal(config.emulators.firestore?.port, 8080, 'Firestore emulator on port 8080');
  assert.equal(config.emulators.ui?.port, 4000, 'UI on port 4000');
  assert.equal(config.emulators.singleProjectMode, true, 'singleProjectMode is enabled');
});

test('js/firebase-init.js: Imports modular emulator connectors', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /connectFirestoreEmulator/, 'Imports connectFirestoreEmulator');
  assert.match(content, /connectAuthEmulator/, 'Imports connectAuthEmulator');
  assert.match(content, /connectFunctionsEmulator/, 'Imports connectFunctionsEmulator');
});

test('js/firebase-init.js: Connects Auth (9099), Firestore (8080) and Functions (5001) for local hostnames', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /connectFunctionsEmulator\s*\(\s*functions\s*,\s*host\s*,\s*5001\s*\)/, 'Functions connected to port 5001');
  assert.match(content, /connectFirestoreEmulator\s*\(\s*db\s*,\s*host\s*,\s*8080\s*\)/, 'Firestore connected to port 8080');
  assert.match(content, /connectAuthEmulator\s*\(\s*auth\s*,\s*`http:\/\/\${host}:9099`/, 'Auth connected to port 9099');
});

test('js/firebase-init.js: Fails closed and prevents silent production fallback', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /window\.firebaseIsReady\s*=\s*false/, 'Marks firebaseIsReady = false on emulator failure');
  assert.match(content, /throw new Error\s*\(\s*`EMULATOR_ISOLATION_FAILED:/, 'Throws explicit error to halt execution');
});

test('js/firebase-init.js: Restricts emulator connection strictly to localhost / 127.0.0.1', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /window\.location\.hostname === 'localhost' \|\| window\.location\.hostname === '127\.0\.0\.1'/, 'Guards emulator connection strictly by local hostname');
});

test('js/firebase-init.js: Guards against duplicate emulator connections', () => {
  const content = fs.readFileSync('js/firebase-init.js', 'utf8');
  assert.match(content, /window\._firebaseEmulatorsConnected/, 'Tracks connection state to prevent double initialization');
});

