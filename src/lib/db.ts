import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runDatabaseMigrations } from './database/migrations';
import { createAllTables } from './database/schema';

// 数据库类型导出
export type DbValue = string | number | bigint | Buffer | null | undefined;
export type DbRow = Record<string, DbValue>;
export type DbRows = DbRow[];
export type DbSelectResult = [DbRows, unknown[]];
export type DbInsertResult = [{ insertId: number | bigint; affectedRows: number }, unknown[]];

// SQLite 数据库路径
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'quotation.db');

// 确保数据目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建 SQLite 数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式以提高性能
db.pragma('busy_timeout = 15000');
try {
  db.pragma('journal_mode = WAL');
} catch (error) {
  // 多进程同时首次打开数据库时，另一进程可能正在切换 WAL。
  // 后续迁移锁会等待该进程完成，因此 SQLITE_BUSY 可安全重用已打开的连接。
  if ((error as { code?: string }).code !== 'SQLITE_BUSY') throw error;
}

const migrationResult = runDatabaseMigrations(db, DB_PATH);
if (migrationResult.appliedVersions.length > 0) {
  console.log(
    `[DB Migration] 已应用版本: ${migrationResult.appliedVersions.join(', ')}`,
    migrationResult.backupPath ? `备份: ${migrationResult.backupPath}` : '',
  );
}

// 测试数据库连接
export async function testConnection() {
  try {
    db.exec('SELECT 1');
    console.log('✅ SQLite 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ SQLite 数据库连接失败:', error);
    return false;
  }
}

// 初始化数据库表
export async function initDatabase() {
  try {
    createAllTables(db);
    console.log('✅ SQLite 数据库表初始化完成');
    return true;
  } catch (error) {
    console.error('❌ SQLite 数据库初始化失败:', error);
    return false;
  }
}

/**
 * 公共 SQL 执行函数，消除 pool 中 execute/query/getConnection 的 4 倍重复代码。
 */
function runSql(sql: string, params?: unknown[]): [unknown, unknown[]] {
  const stmt = db.prepare(sql);
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT') ||
    sql.trim().toUpperCase().startsWith('PRAGMA');
  if (isSelect) {
    const rows = params ? stmt.all(...params) : stmt.all();
    return [rows, []];
  }
  const result = params ? stmt.run(...params) : stmt.run();
  return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }, []];
}

// 兼容 MySQL 风格的 pool 接口
export const pool = {
  execute: async (sql: string, params?: unknown[]) => runSql(sql, params),
  query: async (sql: string, params?: unknown[]) => runSql(sql, params),
  getConnection: async () => ({
    execute: async (sql: string, params?: unknown[]) => runSql(sql, params),
    query: async (sql: string, params?: unknown[]) => runSql(sql, params),
    ping: async () => {},
    release: () => {}
  })
};

// 初始化数据库
initDatabase();

// 导出数据库实例
export { db };
export default pool;
