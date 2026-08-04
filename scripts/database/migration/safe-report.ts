import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ProtectedPathOptions {
  protectedPaths?: readonly string[];
}

interface PathIdentity {
  absolutePath: string;
  canonicalPath: string;
  device?: bigint;
  inode?: bigint;
}

function canonicalizeMissingPath(absolutePath: string): string {
  const parent = path.dirname(absolutePath);
  try {
    return path.join(fs.realpathSync.native(parent), path.basename(absolutePath));
  } catch {
    return absolutePath;
  }
}

function pathIdentity(filePath: string): PathIdentity {
  const absolutePath = path.resolve(filePath);
  let canonicalPath = canonicalizeMissingPath(absolutePath);
  let device: bigint | undefined;
  let inode: bigint | undefined;
  try {
    const stat = fs.statSync(absolutePath, { bigint: true });
    canonicalPath = fs.realpathSync.native(absolutePath);
    device = stat.dev;
    inode = stat.ino;
  } catch {
    // A future report path is compared by its resolved absolute/canonical parent path.
  }
  return { absolutePath, canonicalPath, device, inode };
}

function identitiesOverlap(left: PathIdentity, right: PathIdentity): boolean {
  if (left.absolutePath === right.absolutePath || left.canonicalPath === right.canonicalPath) {
    return true;
  }
  return left.device !== undefined && left.inode !== undefined
    && right.device !== undefined && right.inode !== undefined
    && left.device === right.device && left.inode === right.inode;
}

export function assertDistinctProtectedPaths(
  candidatePath: string,
  protectedPaths: readonly string[],
): void {
  const candidate = pathIdentity(candidatePath);
  for (const protectedPath of protectedPaths) {
    if (identitiesOverlap(candidate, pathIdentity(protectedPath))) {
      throw new Error('Migration report or backup path overlaps a protected data file.');
    }
  }
}

export function discoverProtectedDataPaths(sourcePath: string, cwd = process.cwd()): string[] {
  const protectedPaths = new Set<string>([path.resolve(sourcePath)]);
  const dataDirectory = path.resolve(cwd, 'data');
  try {
    for (const entry of fs.readdirSync(dataDirectory, { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:db|sqlite|sqlite3)$/i.test(entry.name)) {
        protectedPaths.add(path.join(dataDirectory, entry.name));
      }
    }
  } catch {
    // A project without a data directory still protects the explicitly selected source.
  }
  return [...protectedPaths];
}

export function serializeSafeReport(report: unknown): string {
  const serialized = JSON.stringify(report, null, 2);
  if (/postgres(?:ql)?:\/\//i.test(serialized) || /\$2[aby]\$/i.test(serialized)
    || /sha256:/i.test(serialized)) {
    throw new Error('Refusing to persist a report containing secrets.');
  }
  return serialized;
}

function fsyncDirectory(directory: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(directory, 'r');
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertWritableReportDestination(
  reportPath: string,
  options: ProtectedPathOptions,
): void {
  assertDistinctProtectedPaths(reportPath, options.protectedPaths ?? []);
  if (fs.existsSync(reportPath) && fs.statSync(reportPath).isDirectory()) {
    throw new Error('Migration report destination is a directory.');
  }
}

export function preflightJsonReport(
  reportPath: string,
  options: ProtectedPathOptions = {},
): void {
  const absoluteReportPath = path.resolve(reportPath);
  const directory = path.dirname(absoluteReportPath);
  assertWritableReportDestination(absoluteReportPath, options);
  fs.mkdirSync(directory, { recursive: true });
  assertWritableReportDestination(absoluteReportPath, options);
  const probePath = path.join(directory, `.${path.basename(absoluteReportPath)}.${randomUUID()}.probe`);
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(probePath, 'wx', 0o600);
    fs.writeFileSync(descriptor, '{}\n');
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(probePath, { force: true });
  }
}

export function writeJsonReportAtomic(
  reportPath: string,
  report: unknown,
  options: ProtectedPathOptions = {},
): void {
  const absoluteReportPath = path.resolve(reportPath);
  const directory = path.dirname(absoluteReportPath);
  fs.mkdirSync(directory, { recursive: true });
  assertWritableReportDestination(absoluteReportPath, options);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(absoluteReportPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const serialized = `${serializeSafeReport(report)}\n`;
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    assertWritableReportDestination(absoluteReportPath, options);
    fs.renameSync(temporaryPath, absoluteReportPath);
    fsyncDirectory(directory);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}
