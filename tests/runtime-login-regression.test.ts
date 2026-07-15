import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('native runtime dependencies have explicit pnpm build approval', () => {
  const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  for (const dependency of ['better-sqlite3', 'core-js', 'esbuild', 'sharp']) {
    assert.match(
      workspace,
      new RegExp(`^\\s{2}${dependency}: true$`, 'm'),
      `${dependency} must be explicitly approved for native build scripts`,
    );
  }
});

test('both login flows use the safe API response parser', () => {
  const loginPage = fs.readFileSync(path.join(root, 'src/app/login/page.tsx'), 'utf8');
  const userContext = fs.readFileSync(path.join(root, 'src/contexts/user-context.tsx'), 'utf8');

  assert.match(loginPage, /readApiResponse\(response\)/);
  assert.match(userContext, /readApiResponse\(response\)/);
});

test('lint excludes nested git worktrees and their dependency trees', () => {
  const eslintConfig = fs.readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8');
  assert.match(eslintConfig, /'\.worktrees\/\*\*'/);
});
