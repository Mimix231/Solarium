import { defaultWorkspace } from '../domain/defaults';
import type { Workspace } from '../domain/types';
import { validateWorkspace } from '../domain/validation';
import { exportAll } from '../foundation/backup';

const BACKUP_KEY = 'solarium:workspace:v1';
interface SqliteDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}
let dbPromise: Promise<SqliteDatabase> | undefined;
const desktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function database(): Promise<SqliteDatabase | null> {
  if (!desktop()) return null;
  dbPromise ??= (async () => {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const connection = await Database.load('sqlite:solarium.db');
    await connection.execute('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)');
    return connection;
  })();
  return dbPromise;
}

export async function loadWorkspace(): Promise<Workspace> {
  const db = await database();
  if (db) {
    const rows = await db.select<{ data: string }[]>('SELECT data FROM workspace WHERE id = 1');
    if (rows[0]) return validateWorkspace(JSON.parse(rows[0].data));
  }
  const local = localStorage.getItem(BACKUP_KEY);
  return local ? validateWorkspace(JSON.parse(local)) : defaultWorkspace();
}

let pending = Promise.resolve();
export function saveWorkspace(data: Workspace): Promise<void> {
  const json = JSON.stringify(data);
  // Serialize writes: an older save must never overwrite a newer change.
  pending = pending.catch(() => undefined).then(async () => {
    const db = await database();
    if (db) {
      await db.execute('INSERT INTO workspace (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at', [json, new Date().toISOString()]);
    } else {
      localStorage.setItem(BACKUP_KEY, json);
    }
  });
  return pending;
}

export async function exportWorkspace(data: Workspace): Promise<void> {
  const blob = new Blob([JSON.stringify(await exportAll(data), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `solarium-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
