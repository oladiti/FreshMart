#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const server = path.join(root, 'server');
const client = path.join(root, 'client');

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const report = [];

const now = new Date();
report.push(`# Quality Gate Report`);
report.push(``);
report.push(`Generated: ${now.toISOString()}`);
report.push(``);

// Quality gate results
const gate = readJson(path.join(root, 'reports', 'quality-gate.json'));
report.push(`## Pipeline Stages`);
report.push(``);
if (gate) {
  report.push(`| Stage | Status |`);
  report.push(`|-------|--------|`);
  for (const r of gate.results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '◐' : '❌';
    report.push(`| ${icon} ${r.name} | ${r.status} |`);
  }
  report.push(``);
  report.push(`**Result: ${gate.gatePass ? 'PASSED' : 'FAILED'}**`);
} else {
  report.push(`No quality-gate.json found. Run \`npm run quality-gate\` first.`);
}
report.push(``);

// Coverage summaries
report.push(`## Coverage`);
report.push(``);

function addCoverageSection(title, summaryPath) {
  const summary = readJson(summaryPath);
  if (!summary) {
    report.push(`### ${title}`);
    report.push(``);
    report.push(`No coverage data available.`);
    report.push(``);
    return;
  }
  const total = summary.total;
  report.push(`### ${title}`);
  report.push(``);
  report.push(`| Metric | % |`);
  report.push(`|--------|---|`);
  report.push(`| Statements | ${total.statements?.pct ?? 'n/a'} |`);
  report.push(`| Branches | ${total.branches?.pct ?? 'n/a'} |`);
  report.push(`| Functions | ${total.functions?.pct ?? 'n/a'} |`);
  report.push(`| Lines | ${total.lines?.pct ?? 'n/a'} |`);
  report.push(``);
}

addCoverageSection('Server (Backend)', path.join(server, 'coverage', 'coverage-summary.json'));
addCoverageSection('Client (Frontend)', path.join(client, 'coverage', 'coverage-summary.json'));

// Reports availability
report.push(`## Generated Artifacts`);
report.push(``);
report.push(`- Server coverage: \`server/coverage/index.html\``);
report.push(`- Client coverage: \`client/coverage/index.html\``);
report.push(`- Playwright report: \`client/playwright-report/index.html\``);
report.push(``);

const outPath = path.join(root, 'TEST_REPORT.md');
writeFileSync(outPath, report.join('\n'), 'utf8');
console.log(`Report generated at ${outPath}`);
