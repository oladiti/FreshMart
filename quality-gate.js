#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const results = [];
const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';

function run(name, command, cwd) {
  console.log(`\n━━━ ▶ ${name}\n`);
  try {
    execSync(command, { cwd, stdio: 'inherit', encoding: 'utf8' });
    results.push({ name, status: PASS });
    console.log(`\n━━━ ✓ ${name} PASSED\n`);
    return true;
  } catch (err) {
    results.push({ name, status: FAIL });
    console.log(`\n━━━ ✗ ${name} FAILED (exit ${err.status})\n`);
    return false;
  }
}

function skip(name) {
  results.push({ name, status: SKIP });
  console.log(`\n◐ ${name} SKIPPED\n`);
}

const server = path.join(root, 'server');
const client = path.join(root, 'client');

console.log('================================================================');
console.log('  QUALITY GATE - FreshMart Testing Pipeline');
console.log('  Unit → API → Route Regression → UI → Quality Gate → Reports');
console.log('================================================================');

// Stage 1: Unit tests
const unitOk =
  run('1. Server Unit Tests (Jest)', 'npm run test:unit', server) &&
  run('1. Client Unit Tests (Vitest)', 'npm run test:unit', client);

// Stage 2: API integration tests (runs the full backend suite: unit + integration
// together so the global coverage threshold applies across all backend source)
let apiOk = false;
if (!unitOk) {
  skip('2. API Integration Tests (blocked by unit failures)');
} else {
  apiOk = run(
    '2. API Integration Tests (Jest + Supertest)',
    'npm run test:all',
    server
  );
}

// Stage 3: Route regression tests (server-side, no browser needed)
let regressionOk = false;
if (!apiOk) {
  skip('3. Route Regression Tests (blocked by API failures)');
} else {
  regressionOk = run(
    '3. Route Regression Tests (Jest + Supertest)',
    'npm run test:regression',
    server
  );
}

// Stage 4: UI / Regression tests (Playwright)
let uiOk = false;
if (!apiOk) {
  skip('4. UI Tests (blocked by API failures)');
} else if (process.env.SKIP_UI === 'true') {
  skip('4. UI Tests (SKIP_UI=true)');
} else {
  uiOk = run('4. UI Tests (Playwright)', 'npm run test:ui', client);
}

// Stage 4: Quality gate evaluation
const passing = results.filter((r) => r.status === PASS).length;
const failing = results.filter((r) => r.status === FAIL).length;
const skipped = results.filter((r) => r.status === SKIP).length;
const gatePass = failing === 0;

console.log('\n================================================================');
console.log('  QUALITY GATE SUMMARY');
console.log('================================================================');
console.log(`  Passed: ${passing}   Failed: ${failing}   Skipped: ${skipped}`);
console.log('----------------------------------------------------------------');
for (const r of results) {
  console.log(`  ${r.status === PASS ? '✓' : r.status === SKIP ? '◐' : '✗'}  ${r.name}`);
}
console.log('----------------------------------------------------------------');
const serverCovExists = existsSync(path.join(server, 'coverage', 'coverage-summary.json'));
const clientCovExists = existsSync(path.join(client, 'coverage', 'coverage-summary.json'));
console.log(`  Server coverage report: ${serverCovExists ? 'present' : 'n/a'}`);
console.log(`  Client coverage report: ${clientCovExists ? 'present' : 'n/a'}`);
console.log(`  Playwright report: ${existsSync(path.join(client, 'playwright-report', 'index.html')) ? 'present' : 'n/a'}`);

// Stage 5: Generate report
try {
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  const reportPath = path.join(root, 'reports', 'quality-gate.json');
  writeFileSync(
    reportPath,
    JSON.stringify({ date: new Date().toISOString(), gatePass, results }, null, 2)
  );
  console.log(`\n  Machine-readable report: reports/quality-gate.json`);
} catch (err) {
  console.error('Failed to write report:', err.message);
}

console.log('================================================================');
console.log(gatePass ? '  ✅ QUALITY GATE PASSED' : '  ❌ QUALITY GATE FAILED');
console.log('================================================================');

process.exit(gatePass ? 0 : 1);
