'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { apiFetch } from './api-fetch';
import type {
  QuoteLibraryAttachmentCategory,
  QuoteLibraryStagedUpload,
} from './quote-library-types';

interface UploadIntent {
  path: string;
  token: string;
  bucket: string;
}

let client: SupabaseClient | undefined;

export function canUploadQuoteLibraryFilesDirectly(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function getBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase Storage browser configuration is missing.');
    client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return client;
}

export async function cleanupStagedQuoteLibraryUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await apiFetch('/api/quote-library/attachments/upload-url', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
    autoRedirectOnAuth: false,
  });
}

export async function uploadQuoteLibraryFilesDirectly(
  category: QuoteLibraryAttachmentCategory,
  files: File[],
): Promise<QuoteLibraryStagedUpload[]> {
  const uploaded: QuoteLibraryStagedUpload[] = [];
  const storageClient = getBrowserClient();

  try {
    for (const file of files) {
      const intentResult = await apiFetch<UploadIntent>(
        '/api/quote-library/attachments/upload-url',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type,
            file_size: file.size,
            category,
          }),
        },
      );
      const intent = intentResult.data;
      if (!intentResult.success || !intent?.path || !intent.token || !intent.bucket) {
        throw new Error(intentResult.error || '无法创建附件上传授权');
      }

      uploaded.push({
        path: intent.path,
        original_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        category,
      });
      const { error } = await storageClient.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.path, intent.token, file, {
          contentType: file.type || 'application/octet-stream',
        });
      if (error) throw new Error(error.message || '附件上传失败');
    }
    return uploaded;
  } catch (error) {
    await cleanupStagedQuoteLibraryUploads(uploaded.map((item) => item.path)).catch(() => undefined);
    throw error;
  }
}
