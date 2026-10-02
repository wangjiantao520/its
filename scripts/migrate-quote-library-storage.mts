import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

import { createDatabaseClient } from '../src/lib/database/client';
import { buildStoredName, resolveSafeAbsolutePath } from '../src/lib/quote-library-storage';
import { getQuoteLibraryStorageBucket } from '../src/lib/supabase-storage';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../src/lib/quote-library-types';

interface LegacyAttachmentRow extends Record<string, unknown> {
  id: string | number | bigint;
  stored_path: string;
  original_name: string;
  mime_type: string | null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const apply = args.includes('--apply');
  const unexpected = args.filter((arg) => arg !== '--apply');
  if (unexpected.length > 0) {
    throw new Error('Usage: pnpm db:migrate-quote-library-storage [-- --apply]');
  }

  const database = createDatabaseClient({
    url: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL || '',
    driver: 'pg',
    max: 1,
  });

  try {
    const legacy = await database.query<LegacyAttachmentRow>(
      `SELECT id, stored_path, original_name, mime_type
         FROM quote_library_attachments
        WHERE stored_path LIKE 'uploads/quote-library/%'
        ORDER BY id`,
    );

    let available = 0;
    let missing = 0;
    let oversized = 0;
    let migrated = 0;
    const bucket = apply ? getQuoteLibraryStorageBucket() : null;

    for (const row of legacy.rows) {
      const absolutePath = resolveSafeAbsolutePath(row.stored_path);
      if (!absolutePath) {
        missing += 1;
        continue;
      }

      let fileSize: number;
      try {
        fileSize = (await stat(absolutePath)).size;
      } catch {
        missing += 1;
        continue;
      }
      if (fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
        oversized += 1;
        continue;
      }
      available += 1;
      if (!apply || !bucket) continue;

      const contents = await readFile(absolutePath);
      if (contents.byteLength !== fileSize) {
        throw new Error(`Attachment changed while migrating row ${row.id}.`);
      }
      const objectPath = `staging/${randomUUID()}/${buildStoredName(row.original_name)}`;
      const { error: uploadError } = await bucket.upload(objectPath, contents, {
        contentType: row.mime_type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      try {
        const update = await database.query<{ id: string | number | bigint }>(
          `UPDATE quote_library_attachments
              SET stored_path = $1
            WHERE id = $2 AND stored_path = $3
            RETURNING id`,
          [objectPath, row.id, row.stored_path],
        );
        if (update.rowCount !== 1) throw new Error('Attachment row changed during migration.');
      } catch (error) {
        await bucket.remove([objectPath]).catch(() => undefined);
        throw error;
      }
      migrated += 1;
    }

    const mode = apply ? 'Applied' : 'Dry run';
    console.log(`${mode}: ${legacy.rows.length} legacy attachments, ${available} local files available, ${missing} missing, ${oversized} over 20 MB, ${migrated} migrated.`);
    if (!apply && legacy.rows.length > 0) {
      console.log('No files or database rows were changed. Add --apply only after confirming this database and the private Storage bucket.');
    }
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Attachment migration failed.');
  process.exitCode = 1;
});
