# Sidebar Collapse Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop sidebar collapse to a non-overlapping 56px icon rail whose navigation icons remain clickable.

**Architecture:** Keep the existing shadcn `SidebarProvider` state and `collapsible="icon"` behavior. Repair the recursive CSS custom-property defaults at the shared sidebar layer, then make the application header/footer explicitly icon-mode aware and cover the result with a browser-level regression test.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Node test runner, Playwright

---

### Task 0: Repair the pre-existing TypeScript baseline

**Files:**
- Modify: `src/app/api/agents/[id]/chat/route.ts`
- Modify: `src/app/maintenance/page.tsx:2975`

- [ ] **Step 1: Confirm the existing type failures**

Run `pnpm ts-check`. Expected: three errors for `Response.json` and two implicit-`any` errors for `pageNum`.

- [ ] **Step 2: Use the framework response helper**

Import `NextResponse` from `next/server` and replace the three error-path calls to `Response.json(...)` with `NextResponse.json(...)`. Keep the streaming success response as the standard `new Response(stream, ...)`.

- [ ] **Step 3: Give the page number an explicit numeric type**

Change `let pageNum;` to `let pageNum: number;` in the pagination callback.

- [ ] **Step 4: Verify the baseline is green**

Run `pnpm ts-check`. Expected: exit code 0 with no TypeScript errors.

### Task 1: Add a browser regression test

**Files:**
- Create: `tests/sidebar-collapse.e2e.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a self-contained sidebar browser test**

Create `tests/sidebar-collapse.e2e.mjs` with this self-contained test:

```js
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
  await page.locator('[data-slot="sidebar"][data-mobile="true"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="sidebar"][data-mobile="true"]').isVisible(),
    true,
  );
  await page.close();
});
```

- [ ] **Step 2: Add the exact test command**

Add this script to `package.json`:

```json
"test:sidebar": "node --test tests/sidebar-collapse.e2e.mjs"
```

- [ ] **Step 3: Install dependencies and the Chromium runtime**

Run:

```bash
pnpm install
pnpm exec playwright install chromium
```

Expected: dependencies and Chromium install successfully using pnpm.

- [ ] **Step 4: Run the test and verify RED**

Run:

```bash
pnpm test:sidebar
```

Expected: FAIL because the current recursive `--sidebar-width-icon` value does not compute to 56px and/or sidebar descendants cross the container boundary.

### Task 2: Repair the sidebar width and collapsed content

**Files:**
- Modify: `src/components/ui/sidebar.tsx:30-32`
- Modify: `src/components/layout/app-sidebar.tsx:147-211`

- [ ] **Step 1: Replace recursive custom-property values with concrete defaults**

In `src/components/ui/sidebar.tsx`, use concrete values so the provider does not assign a CSS variable to itself:

```ts
const SIDEBAR_WIDTH = '180px';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '56px';
```

The provider's existing `...style` ordering remains unchanged so callers can still override either custom property.

- [ ] **Step 2: Make application content safe in icon mode**

In `src/components/layout/app-sidebar.tsx`, apply these exact behavior changes:

```tsx
<Sidebar
  variant="inset"
  collapsible="icon"
  className="overflow-hidden border-r sidebar-fabric"
>
  <SidebarHeader className="border-b px-6 py-4 group-data-[collapsible=icon]:px-2">
    <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground group-data-[collapsible=icon]:hidden">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
        <h1 className="text-lg font-semibold truncate">ITS报价系统</h1>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8 shrink-0"
        title={state === 'collapsed' ? '展开侧边栏' : '收起侧边栏'}
      >
        {state === 'collapsed' ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>
    </div>
  </SidebarHeader>
```

Add `tooltip={item.title}` to `SidebarMenuButton`, and add `group-data-[collapsible=icon]:hidden` to the existing `SidebarFooter` class. Do not add another React state.

Use Tailwind parent-state variants based on `group-data-[collapsible=icon]`; do not add another React state.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
pnpm test:sidebar
```

Expected: PASS; both measured widths are 56px, no descendant crosses the boundary, and clicking the engineering icon navigates to `/engineering`.

### Task 3: Validate the complete change

**Files:**
- Verify: `src/components/ui/sidebar.tsx`
- Verify: `src/components/layout/app-sidebar.tsx`
- Verify: `tests/sidebar-collapse.e2e.mjs`

- [ ] **Step 1: Run static validation**

Run:

```bash
pnpm validate
```

Expected: TypeScript and quiet ESLint checks exit with zero errors.

- [ ] **Step 2: Run a production build**

Run:

```bash
pnpm build
```

Expected: the Next.js build and server bundle complete successfully.

- [ ] **Step 3: Re-run the browser regression test against the final source**

Run:

```bash
pnpm test:sidebar
```

Expected: PASS with one test and zero failures.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the plan, test, package metadata, and targeted sidebar files are changed.
