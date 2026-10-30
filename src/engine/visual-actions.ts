import type { LiveFile, LiveWorkspaceUpdate, WorkKind, WorkStatus } from './live-workspace';

/** The user's durable, verifiable record of work. Neither prose nor intent can mark an action successful. */
export type SourceStatus = 'found' | 'reading' | 'read' | 'failed';
export interface VisualSource { url: string; title: string; excerpt?: string; status: SourceStatus }
export interface VisualAction {
  id: string; sessionId: string; messageId: string; kind: WorkKind; status: WorkStatus;
  title: string; detail: string; createdAt: string; updatedAt: string;
  files?: LiveFile[]; activeFile?: string; output?: string; url?: string;
  sources?: VisualSource[]; query?: string;
}
export interface ActionUpdate extends LiveWorkspaceUpdate {
  operationId: string;
  sources?: VisualSource[];
  query?: string;
}
const cap = (value: string | undefined, length: number) => value?.slice(0, length);
/** Bounded persistence: full source stays in the user's real project; snapshots are a preview. */
export function evolveVisualAction(previous: VisualAction | undefined, event: ActionUpdate,
  sessionId: string, messageId: string, at: string): VisualAction {
  if (!event.operationId || !sessionId || !messageId) throw new Error('Visual actions require an operation and conversation identity.');
  if (previous && (previous.sessionId !== sessionId || previous.messageId !== messageId || previous.id !== event.operationId)) {
    throw new Error('An operation may not migrate between conversations or assistant messages.');
  }
  const next: VisualAction = {
    id: event.operationId, sessionId, messageId,
    kind: event.kind, status: event.status,
    title: cap(event.title, 260) ?? '', detail: cap(event.detail, 1600) ?? '',
    createdAt: previous?.createdAt ?? at, updatedAt: at,
  };
  const files = event.files ?? previous?.files;
  if (files?.length) next.files = files.slice(0, 12).map(file => ({path: file.path.slice(0, 1024), content: file.content.slice(0, 120_000), complete: file.complete}));
  const sources = event.sources ?? previous?.sources;
  if (sources?.length) next.sources = sources.slice(0, 24).filter(source => /^https:\/\//i.test(source.url)).map(source => ({
    title: source.title.slice(0, 240), url: source.url.slice(0, 1800), status: source.status,
    ...(source.excerpt ? { excerpt: source.excerpt.slice(0, 1000) } : {}),
  }));
  const activeFile = event.activeFile ?? previous?.activeFile;
  const output = event.output ?? previous?.output;
  const url = event.url ?? previous?.url;
  const query = event.query ?? previous?.query;
  if (activeFile) next.activeFile = cap(activeFile, 1024);
  if (output) next.output = cap(output, 48_000);
  if (url) next.url = cap(url, 1800);
  if (query) next.query = cap(query, 1000);
  return next;
}
/** An abandoned running operation is not a completed operation after restart. */
export function restoreVisualAction(action: VisualAction): VisualAction {
  return action.status === 'running' ? {
    ...action, status: 'failed', detail: `${action.detail}\nOperation interrupted before confirmation. No completion is assumed.`.slice(0, 1600),
  } : action;
}
export const visibleActions = (actions: readonly VisualAction[], sessionId: string, messageId: string): VisualAction[] =>
  actions.filter(a => a.sessionId === sessionId && a.messageId === messageId);
