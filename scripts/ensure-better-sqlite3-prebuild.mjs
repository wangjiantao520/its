import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  readFileSync, rmSync, existsSync, mkdirSync,
  writeFileSync, copyFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRequire = createRequire(import.meta.url);

function compareVersions(left, right) {
  const [leftMajor, leftMinor] = left.split('.').map(Number);
  const [rightMajor, rightMinor] = right.split('.').map(Number);
  return leftMajor - rightMajor || leftMinor - rightMinor;
}

export function createPrebuildArgs({ packageRoot, nodeVersion, arch }) {
  return [
    '--force',
    '--verbose',
    '--runtime=node',
    `--target=${nodeVersion}`,
    '--platform=linux',
    `--arch=${arch}`,
    `--path=${packageRoot}`,
  ];
}

export function assertCompatibleGlibc(binary, maximumVersion = '2.29') {
  const versions = [
    ...binary.toString('latin1').matchAll(/GLIBC_(\d+\.\d+)/g),
  ].map((match) => match[1]);

  if (versions.length === 0) {
    throw new Error('Unable to determine the GLIBC requirement of better_sqlite3.node');
  }

  const requiredVersion = versions.sort(compareVersions).at(-1);
  if (compareVersions(requiredVersion, maximumVersion) > 0) {
    throw new Error(
      `better_sqlite3.node requires GLIBC ${requiredVersion}; maximum allowed is ${maximumVersion}`,
    );
  }

  return requiredVersion;
}

function getPrebuildUrl() {
  const packageJsonPath = projectRequire.resolve('better-sqlite3/package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const abi = process.versions.modules;
  const arch = process.arch;
  const filename = `better-sqlite3-v${pkg.version}-node-v${abi}-linux-${arch}.tar.gz`;
  return {
    filename,
    urls: [
      `https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${filename}`,
      `https://ghfast.top/https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${filename}`,
      `https://gh-proxy.com/https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${filename}`,
    ],
  };
}

async function fetchWithTimeout(url, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function downloadAndExtractPrebuild(packageRoot, bindingPath) {
  const { filename, urls } = getPrebuildUrl();
  const tmpDir = join(packageRoot, '.prebuild-tmp');
  mkdirSync(tmpDir, { recursive: true });
  const tarGzPath = join(tmpDir, filename);

  let downloaded = false;
  for (const url of urls) {
    try {
      console.log(`[native-sqlite] Trying download: ${url.slice(0, 80)}...`);
      const buf = await fetchWithTimeout(url);
      writeFileSync(tarGzPath, buf);
      console.log(`[native-sqlite] Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      downloaded = true;
      break;
    } catch (err) {
      console.log(`[native-sqlite] Download failed: ${err.message}`);
    }
  }

  if (!downloaded) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('All download URLs failed');
  }

  console.log('[native-sqlite] Extracting prebuild...');
  execFileSync('tar', ['xzf', tarGzPath, '-C', tmpDir], { stdio: 'pipe' });

  const extractedBinding = join(tmpDir, 'build', 'Release', 'better_sqlite3.node');
  if (!existsSync(extractedBinding)) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Extracted archive does not contain better_sqlite3.node');
  }

  const buildDir = dirname(bindingPath);
  mkdirSync(buildDir, { recursive: true });
  copyFileSync(extractedBinding, bindingPath);

  rmSync(tmpDir, { recursive: true, force: true });
  console.log('[native-sqlite] Prebuild placed successfully');
}

function verifyBinding(bindingPath, maximumGlibc) {
  const requiredGlibc = assertCompatibleGlibc(readFileSync(bindingPath), maximumGlibc);
  const Database = projectRequire('better-sqlite3');
  const database = new Database(':memory:');
  const result = database.prepare('SELECT 1 AS ok').get();
  database.close();
  if (result?.ok !== 1) {
    throw new Error('better-sqlite3 smoke test returned an unexpected result');
  }
  return requiredGlibc;
}

export async function installCompatiblePrebuild() {
  if (process.platform !== 'linux') {
    console.log(
      `[native-sqlite] Skipping Linux prebuild refresh on ${process.platform}/${process.arch}`,
    );
    return;
  }

  const packageJsonPath = projectRequire.resolve('better-sqlite3/package.json');
  const packageRoot = dirname(packageJsonPath);
  const packageRequire = createRequire(packageJsonPath);
  const bindingPath = join(packageRoot, 'build', 'Release', 'better_sqlite3.node');
  const maximumGlibc = process.env.BETTER_SQLITE3_MAX_GLIBC || '2.29';

  // Reuse existing binding if pnpm install already produced one
  if (existsSync(bindingPath)) {
    try {
      const requiredGlibc = verifyBinding(bindingPath, maximumGlibc);
      console.log(
        `[native-sqlite] Existing binding works (GLIBC ${requiredGlibc}); skipping download`,
      );
      return;
    } catch {
      rmSync(join(packageRoot, 'build'), { recursive: true, force: true });
    }
  }

  console.log(
    `[native-sqlite] Installing prebuild for Node ${process.versions.node} ` +
      `(ABI ${process.versions.modules}) on linux/${process.arch}`,
  );

  // Strategy 1: prebuild-install (may timeout if GitHub is unreachable)
  try {
    const installerPath = packageRequire.resolve('prebuild-install/bin.js');
    console.log('[native-sqlite] Strategy 1: prebuild-install...');
    execFileSync(
      process.execPath,
      [installerPath, ...createPrebuildArgs({
        packageRoot,
        nodeVersion: process.versions.node,
        arch: process.arch,
      })],
      {
        cwd: packageRoot,
        env: { ...process.env, npm_config_build_from_source: 'false' },
        stdio: 'inherit',
        timeout: 60_000,
      },
    );
  } catch (err) {
    console.log(`[native-sqlite] prebuild-install failed (${err.message}), trying direct fetch...`);

    // Strategy 2: direct fetch with proxy fallbacks
    try {
      console.log('[native-sqlite] Strategy 2: direct fetch with proxy mirrors...');
      await downloadAndExtractPrebuild(packageRoot, bindingPath);
    } catch (fetchErr) {
      throw new Error(
        `All prebuild strategies failed.\n` +
        `  prebuild-install: ${err.message}\n` +
        `  direct fetch: ${fetchErr.message}`,
      );
    }
  }

  const requiredGlibc = verifyBinding(bindingPath, maximumGlibc);
  console.log(`[native-sqlite] Verified binding; GLIBC ${requiredGlibc}`);
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  installCompatiblePrebuild().catch((error) => {
    console.error('[native-sqlite] Failed:', error.message);
    process.exitCode = 1;
  });
}
