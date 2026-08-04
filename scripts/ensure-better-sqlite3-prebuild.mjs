import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, rmSync } from 'node:fs';
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

export function installCompatiblePrebuild() {
  if (process.platform !== 'linux') {
    console.log(
      `[native-sqlite] Skipping Linux prebuild refresh on ${process.platform}/${process.arch}`,
    );
    return;
  }

  const packageJsonPath = projectRequire.resolve('better-sqlite3/package.json');
  const packageRoot = dirname(packageJsonPath);
  const packageRequire = createRequire(packageJsonPath);
  const installerPath = packageRequire.resolve('prebuild-install/bin.js');
  const bindingPath = join(packageRoot, 'build', 'Release', 'better_sqlite3.node');
  const maximumGlibc = process.env.BETTER_SQLITE3_MAX_GLIBC || '2.29';

  console.log(
    `[native-sqlite] Installing official prebuild for Node ${process.versions.node} ` +
      `(ABI ${process.versions.modules}) on linux/${process.arch}`,
  );

  // pnpm may preserve a source-built native binding from Coze's newer build
  // container. Remove it so prebuild-install cannot silently reuse that file.
  rmSync(join(packageRoot, 'build'), { recursive: true, force: true });

  execFileSync(
    process.execPath,
    [
      installerPath,
      ...createPrebuildArgs({
        packageRoot,
        nodeVersion: process.versions.node,
        arch: process.arch,
      }),
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        npm_config_build_from_source: 'false',
      },
      stdio: 'inherit',
    },
  );

  const requiredGlibc = assertCompatibleGlibc(
    readFileSync(bindingPath),
    maximumGlibc,
  );

  const Database = projectRequire('better-sqlite3');
  const database = new Database(':memory:');
  const result = database.prepare('SELECT 1 AS ok').get();
  database.close();

  if (result?.ok !== 1) {
    throw new Error('better-sqlite3 smoke test returned an unexpected result');
  }

  console.log(
    `[native-sqlite] Verified official binding; maximum required GLIBC is ${requiredGlibc}`,
  );
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    installCompatiblePrebuild();
  } catch (error) {
    console.error('[native-sqlite] Failed to install a deploy-compatible binding:', error);
    process.exitCode = 1;
  }
}
