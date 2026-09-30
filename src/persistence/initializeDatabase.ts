import type { SQLiteDatabase } from 'expo-sqlite';

/** Connection policy only. Match schemas and migrations begin in Phase 3. */
export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA synchronous = FULL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');
}
