import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  // The seed connects directly to MongoDB (via server/config), so it does NOT
  // require the Express webServer to be up yet. globalSetup runs before
  // Playwright launches the webServer entries, which is exactly what we want.
  const serverDir = path.resolve(__dirname, '..', '..', 'server');
  const seedScript = path.join(serverDir, 'e2e-seed.js');

  try {
    const output = execSync(`node "${seedScript}"`, {
      cwd: serverDir,
      encoding: 'utf8',
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(output.trim());
  } catch (err) {
    // Seeding is best-effort; some tests are conditional on data existing.
    // Log loudly but don't hard-fail the whole run if the DB is unreachable.
    console.warn('E2E globalSetup: could not seed database.');
    if (err.stdout) console.warn(String(err.stdout));
    if (err.stderr) console.warn(String(err.stderr));
  }
}
