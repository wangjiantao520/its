import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Coze build replaces cached better-sqlite3 binaries before Next.js build', async () => {
  const buildScript = await readFile('scripts/build.sh', 'utf8');

  assert.match(
    buildScript,
    /node \.\/scripts\/ensure-better-sqlite3-prebuild\.mjs/,
  );
});

test('native SQLite installer forces the official Node prebuild and rejects GLIBC 2.38', async () => {
  const runtime = await import('../scripts/ensure-better-sqlite3-prebuild.mjs');
  const args = runtime.createPrebuildArgs({
    packageRoot: '/tmp/better-sqlite3',
    nodeVersion: '24.18.0',
    arch: 'x64',
  });

  assert.ok(args.includes('--force'));
  assert.ok(args.includes('--runtime=node'));
  assert.ok(args.includes('--target=24.18.0'));
  assert.ok(args.includes('--platform=linux'));
  assert.ok(args.includes('--arch=x64'));
  assert.throws(
    () => runtime.assertCompatibleGlibc(Buffer.from('GLIBC_2.29\0GLIBC_2.38\0'), '2.29'),
    /requires GLIBC 2\.38/,
  );
  assert.doesNotThrow(() =>
    runtime.assertCompatibleGlibc(Buffer.from('GLIBC_2.2\0GLIBC_2.29\0'), '2.29'),
  );
});
