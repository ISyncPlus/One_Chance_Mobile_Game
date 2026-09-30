import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

export function useDatabaseStatus() {
  const database = useSQLiteContext();
  const [status, setStatus] = useState('SQLite opening');
  useEffect(() => {
    let active = true;
    async function inspect() {
      const version = await database.getFirstAsync<{ version: string }>('SELECT sqlite_version() AS version');
      const journal = await database.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode');
      const sync = await database.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous');
      const keys = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
      if (journal?.journal_mode !== 'wal' || sync?.synchronous !== 2 || keys?.foreign_keys !== 1) {
        throw new Error('SQLite connection policy mismatch');
      }
      if (active) setStatus(`SQLite ${version?.version ?? 'unknown'} · WAL / FULL / FK on`);
    }
    void inspect().catch((error: unknown) => {
      console.error('SQLite diagnostic failed', error);
      if (active) setStatus(`SQLite ERROR: ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => { active = false; };
  }, [database]);
  return status;
}
