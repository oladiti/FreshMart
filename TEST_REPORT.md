# Quality Gate Report

Generated: 2026-09-01T14:01:27.979Z

## Pipeline Stages

| Stage | Status |
|-------|--------|
| ✅ 1. Server Unit Tests (Jest) | PASS |
| ✅ 1. Client Unit Tests (Vitest) | PASS |
| ✅ 2. API Integration Tests (Jest + Supertest) | PASS |
| ◐ 3. UI / Regression Tests (SKIP_UI=true) | SKIP |

**Result: PASSED**

## Coverage

### Server (Backend)

| Metric | % |
|--------|---|
| Statements | 47.41 |
| Branches | 40.4 |
| Functions | 58.18 |
| Lines | 47.83 |

### Client (Frontend)

| Metric | % |
|--------|---|
| Statements | 85.8 |
| Branches | 67.46 |
| Functions | 88.37 |
| Lines | 87.85 |

## Generated Artifacts

- Server coverage: `server/coverage/index.html`
- Client coverage: `client/coverage/index.html`
- Playwright report: `client/playwright-report/index.html`
