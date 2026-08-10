import bcrypt from 'bcryptjs';

import type { DatabaseClient } from './database/client';

const DEFAULT_SECONDARY_PASSWORD = 'admin';
const SECONDARY_PASSWORD_KEY = 'secondary_password';

interface SettingsRow extends Record<string, unknown> {
  key: string;
  value: string;
}

export async function ensureSecondaryPassword(
  database: DatabaseClient,
): Promise<void> {
  const existing = await database.query<SettingsRow>(
    'SELECT key FROM system_settings WHERE key = $1',
    [SECONDARY_PASSWORD_KEY],
  );
  if (existing.rows[0]) return;
  const hash = await bcrypt.hash(DEFAULT_SECONDARY_PASSWORD, 10);
  await database.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SECONDARY_PASSWORD_KEY, hash],
  );
}

export async function verifySecondaryPassword(
  database: DatabaseClient,
  password: string,
): Promise<boolean> {
  if (!password) return false;
  const result = await database.query<SettingsRow>(
    'SELECT value FROM system_settings WHERE key = $1',
    [SECONDARY_PASSWORD_KEY],
  );
  const hash = result.rows[0]?.value;
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function setSecondaryPassword(
  database: DatabaseClient,
  password: string,
): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await database.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SECONDARY_PASSWORD_KEY, hash],
  );
}
