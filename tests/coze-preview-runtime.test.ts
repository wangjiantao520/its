import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Coze preview uses the production build without development HMR', async () => {
  const [cozeConfig, startScript] = await Promise.all([
    readFile('.coze', 'utf8'),
    readFile('scripts/start.sh', 'utf8'),
  ]);

  const devSection = cozeConfig.match(/\[dev\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? '';

  assert.match(devSection, /build\s*=\s*\[\s*"bash",\s*"\.\/scripts\/build\.sh"\s*\]/);
  assert.match(devSection, /run\s*=\s*\[\s*"bash",\s*"\.\/scripts\/start\.sh"\s*\]/);
  assert.match(startScript, /COZE_PROJECT_ENV="\$\{COZE_PROJECT_ENV:-PROD\}"/);
});
