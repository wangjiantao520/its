import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const port = 5055;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let browser;
let serverOutput = '';

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

test.before(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port) },
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
