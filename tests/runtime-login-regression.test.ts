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

  const safeParserCall = /readApiResponse(?:<[^)]+>)?\(response\)/;
  assert.match(loginPage, safeParserCall);
  assert.match(userContext, safeParserCall);
});

test('lint excludes nested git worktrees and their dependency trees', () => {
  const eslintConfig = fs.readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8');
  assert.match(eslintConfig, /'\.worktrees\/\*\*'/);
});

test('Next.js development resources allow the Coze preview origin', () => {
  const nextConfig = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');
  assert.match(
    nextConfig,
    /['"]code\.coze\.cn['"]/,
    'code.coze.cn must be allowed so the Coze preview can hydrate the client application',
  );
});

test('Coze development server uses Webpack to avoid the Turbopack router initialization race', () => {
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
  assert.match(
    server,
    /webpack:\s*dev/,
    'the custom development server must use Webpack because Turbopack HMR can dispatch before the App Router initializes in Coze preview',
  );
});

test('Webpack development uses Next.js SWC instead of the incompatible global Babel preset', () => {
  assert.equal(
    fs.existsSync(path.join(root, '.babelrc')),
    false,
    'a root Babel preset rewrites Unicode property escapes in react-markdown dependencies and breaks Coze routes',
  );
});
