/** Sources and authored work share durable storage, never implicit permission scopes. */
export type SourceScope = { kind: 'chat'; id: string } | { kind: 'project'; id: string };
export type LibraryScope = SourceScope | { kind: 'library'; id: 'personal' };
export interface AccessContext { sessionId: string | null; projectId: string | null }
export interface StoredRecord<T = unknown> {
  id: string; collection: string; scope: LibraryScope; storyId?: string | null;
  title: string; data: T; version: number; updatedAt: string;
}
export interface RecordWrite { record: StoredRecord; expected: number | null; body?: string }
export interface RecordDelete { id: string; expected: number }
export interface StoreFilter { collection?: string; scopes: LibraryScope[]; storyId?: string; query?: string }
export interface RecordStore {
  list<T>(filter: StoreFilter): Promise<StoredRecord<T>[]>;
  body(id: string, scopes: LibraryScope[]): Promise<string | null>;
  batch(puts: RecordWrite[], deletes?: RecordDelete[]): Promise<void>;
}
export const sameScope = (a: LibraryScope, b: LibraryScope): boolean => a.kind === b.kind && a.id === b.id;
export function accessibleScopes(context: AccessContext, personal = false): LibraryScope[] {
  return [...(context.sessionId ? [{ kind: 'chat' as const, id: context.sessionId }] : []),
    ...(context.projectId ? [{ kind: 'project' as const, id: context.projectId }] : []),
    ...(personal ? [{ kind: 'library' as const, id: 'personal' as const }] : [])];
}
export function assertScope(scope: LibraryScope, context: AccessContext, personal = false): void {
  if (!scope || typeof scope.id !== 'string' || !scope.id || !accessibleScopes(context, personal).some(s => sameScope(s, scope))) throw Error('This record belongs to another conversation or project.');
}
export const MAX_BODY = 2_000_000;
export function validateBody(body: unknown): asserts body is string {
  if (typeof body !== 'string' || body.length > MAX_BODY) throw Error('Content must be text smaller than 2 MB.');
}
