import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const port = 5055;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let browser;
let serverOutput = '';
const databasePath = `/tmp/its-sidebar-e2e-${process.pid}.db`;

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Development server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${serverOutput}`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login?role=admin`);
  await page.getByLabel('管理员密码').fill('admin123');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/'),
    page.getByRole('button', { name: '登 录' }).click(),
  ]);
}

async function loginMember(page) {
  await page.goto(`${baseUrl}/login?role=its`);
  await page.getByLabel('用户名').fill('demo');
  await page.getByLabel('密码').fill('demo123');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/device-import'),
    page.getByRole('button', { name: '登 录' }).click(),
  ]);
  const status = await page.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    return token ? (await fetch('/api/auth', { headers: { Authorization: `Bearer ${token}` } })).status : 0;
  });
  assert.equal(status, 200, 'member token should be persisted immediately after login');
}

function observeFailures(page, failures) {
  page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('response', response => {
    const status = response.status();
    if (status >= 500 || status === 401 || status === 403) {
      failures.push(`${status}: ${response.url()}`);
    }
  });
}

test.before(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), DB_PATH: databasePath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser?.close();
  if (server?.pid && server.exitCode === null) {
    process.kill(-server.pid, 'SIGTERM');
  }
  for (const suffix of ['', '-wal', '-shm', '.migrate.lock']) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
});

test('collapsed desktop sidebar is a safe clickable icon rail', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);
  await page.locator('header [data-sidebar="trigger"]').click();
  await page.locator('[data-slot="sidebar"][data-state="collapsed"]').waitFor();

  await page.waitForFunction(() => {
    const element = document.querySelector('[data-slot="sidebar-container"]');
    return element && Math.round(element.getBoundingClientRect().width) === 56;
  });

  const container = page.locator('[data-slot="sidebar-container"]');
  const gap = page.locator('[data-slot="sidebar-gap"]');
  const containerBox = await container.boundingBox();
  const gapBox = await gap.boundingBox();
  assert.ok(containerBox);
  assert.ok(gapBox);
  assert.equal(Math.round(containerBox.width), 56);
  assert.equal(Math.round(gapBox.width), 56);

  const maxDescendantRight = await container.evaluate(element =>
    Math.max(
      ...Array.from(element.querySelectorAll('*'))
        .filter(child => getComputedStyle(child).display !== 'none')
        .map(child => child.getBoundingClientRect().right),
    ),
  );
  assert.ok(maxDescendantRight <= containerBox.x + containerBox.width + 1);

  const engineeringLink = container.locator('a[href="/engineering"]');
  await engineeringLink.hover();
  await page.getByRole('tooltip').filter({ hasText: '工程报价' }).waitFor();
  await Promise.all([
    page.waitForURL(url => url.pathname === '/engineering'),
    engineeringLink.click(),
  ]);
  await page.close();
});

test('mobile sidebar still opens as a drawer', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(page);
  await page.locator('header [data-sidebar="trigger"]').click();
  const mobileSidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  await mobileSidebar.waitFor();
  assert.equal(await mobileSidebar.isVisible(), true);
  await page.close();
});

test('admin routes render without blank pages, overflow, auth failures or server errors', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  observeFailures(page, failures);
  await login(page);

  const routes = [
    '/', '/dashboard', '/engineering', '/maintenance', '/database', '/quotes', '/history',
    '/reports', '/assistant', '/admin/members', '/admin/ai-config', '/admin/agents',
    '/settings/ai-models', '/device-import', '/survey-upload',
  ];
  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${route} should load successfully`);
    await page.waitForFunction(() => document.body.innerText.trim().length > 10);
    const state = await page.evaluate(() => ({
      textLength: document.body.innerText.trim().length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(state.textLength > 10, `${route} should not be blank`);
    assert.ok(state.scrollWidth <= state.clientWidth + 1, `${route} should not overflow horizontally`);
  }

  await page.goto(`${baseUrl}/admin/users`);
  await page.waitForURL(url => url.pathname === '/admin/members');
  assert.deepEqual(failures, []);
  await page.close();
});

test('member routes stay usable and admin routes remain inaccessible', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const failures = [];
  observeFailures(page, failures);
  await loginMember(page);

  for (const route of ['/', '/engineering', '/maintenance', '/quotes', '/history', '/assistant']) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${route} should load for a member`);
    await page.waitForFunction(() => document.body.innerText.trim().length > 10);
    const routeAuth = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken');
      const status = token
        ? (await fetch('/api/auth', { headers: { Authorization: `Bearer ${token}` } })).status
        : 0;
      return { status, hasToken: Boolean(token) };
    });
    assert.deepEqual(routeAuth, { status: 200, hasToken: true }, `${route} must preserve the member session`);
  }

  const authStatus = await page.evaluate(async () => {
    const token = localStorage.getItem('authToken');
    return (await fetch('/api/auth', { headers: { Authorization: `Bearer ${token}` } })).status;
  });
  assert.equal(authStatus, 200, 'member session should still be valid before the permission redirect');
  await page.goto(`${baseUrl}/admin/members`);
  await page.waitForURL(url => url.pathname !== '/admin/members');
  assert.equal(new URL(page.url()).pathname, '/');
  assert.deepEqual(failures, []);
  await page.close();
});
