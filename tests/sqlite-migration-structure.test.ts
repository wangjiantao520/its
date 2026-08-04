import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('source and target money canonicalizers stay in separate modules', () => {
  const sourceCanonicalizer = fs.readFileSync(
    'scripts/database/migration/source-canonicalizer.ts',
    'utf8',
  );
  const targetCanonicalizer = fs.readFileSync(
    'scripts/database/migration/target-canonicalizer.ts',
    'utf8',
  );
  const rowVerifier = fs.readFileSync('scripts/database/migration/row-verifier.ts', 'utf8');

  assert.match(sourceCanonicalizer, /export function canonicalizeSourceMoney/);
  assert.doesNotMatch(sourceCanonicalizer, /canonicalizeTargetMoney/);
  assert.match(targetCanonicalizer, /export function canonicalizeTargetMoney/);
  assert.doesNotMatch(targetCanonicalizer, /canonicalizeSourceMoney/);
  assert.doesNotMatch(rowVerifier, /function parseSourceMoneyToCents/);
  assert.doesNotMatch(rowVerifier, /function parseTargetMoneyToCents/);
});

test('documented migration reports use the gitignored data report pattern', () => {
  const runbook = fs.readFileSync('docs/database-migration.md', 'utf8');
  const gitignore = fs.readFileSync('.gitignore', 'utf8');

  assert.match(gitignore, /^data\/migration-\*\.json$/m);
  assert.match(runbook, /--report data\/migration-import-report\.json/);
  assert.match(runbook, /--report data\/migration-verification-report\.json/);
  assert.doesNotMatch(runbook, /--report (?:migration|verification)-report\.json/);
});
