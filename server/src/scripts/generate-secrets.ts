import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Fills in any missing JWT secret in server/.env with a long random value. Existing values are
// kept, and no secret is ever printed. Creates .env from .env.example if it doesn't exist yet.

const SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const SECRET_BYTES = 48;

const serverDir = path.resolve(import.meta.dirname, '../..');
const envPath = path.join(serverDir, '.env');

if (!existsSync(envPath)) {
  copyFileSync(path.join(serverDir, '.env.example'), envPath);
}

let content = readFileSync(envPath, 'utf8');
const generated: string[] = [];

for (const key of SECRET_KEYS) {
  const line = new RegExp(`^${key}=(.*)$`, 'm');
  const current = line.exec(content)?.[1]?.trim() ?? '';
  if (current.length > 0) {
    continue;
  }
  const entry = `${key}=${randomBytes(SECRET_BYTES).toString('base64url')}`;
  content = line.test(content) ? content.replace(line, entry) : `${content.trimEnd()}\n${entry}\n`;
  generated.push(key);
}

writeFileSync(envPath, content);
process.stdout.write(
  generated.length > 0
    ? `Generated ${generated.join(' and ')} in server/.env\n`
    : 'JWT secrets are already set in server/.env, nothing changed\n',
);
