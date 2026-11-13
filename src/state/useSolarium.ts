import { create } from 'zustand';
import { defaultWorkspace, newSpark } from '../domain/defaults';
import type { ActivityEvent, BlockAsset, ChatMessage, ChatSession, ConsoleChannel, CreatorProject, LocalModel, MemoryItem, Preferences, Spark, SparkMode, Workspace } from '../domain/types';
import { now, uid } from '../domain/types';
import { loadWorkspace, saveWorkspace } from '../data/repository';
import { mergeCatalog } from '../engine/catalog';
import { forkChatSession, rewindChatSession } from '../domain/conversations';
import type { VisualAction } from '../engine/visual-actions';
import { cleanupDeletedOwners } from '../foundation/backup';

export type View = 'home' | 'chat' | 'projects' | 'code' | 'sparks' | 'models' | 'runtime' | 'worlds' | 'laboratory' | 'teams' | 'memories' | 'settings' | 'sources' | 'writing' | 'stories';
interface SolariumState {
  webEnabled:boolean;setWebEnabled:(enabled:boolean)=>void;
  pendingComposer:string|null;
  writingRewrite:{selection:import('../writing/types').WritingSelection;replacement:string|null}|null;
  workspace: Workspace; ready: boolean; error: string | null;
  view: View; editingSparkId: string | null;
  events: ActivityEvent[];
  hydrate: () => Promise<void>;
  setView: (view: View) => void;
  setEditingSparkId: (id: string | null) => void;
  mutate: (fn: (draft: Workspace) => void) => void;
  addSpark: () => void; updateSpark: (id: string, patch: Partial<Spark>) => void;
  deleteSpark: (id: string) => void; selectSpark: (id: string) => void;
  createSession: (sparkId?: string, projectId?: string | null) => string;
  addProject: (name: string, folder?: string, sparkId?: string | null, modelId?: string | null) => string;
  addChannel: (title: string, projectId: string | null, sparkId: string | null) => string;
  removeChannel: (id: string) => void;
  openChannel: (id: string) => void; updateProject: (id: string, patch: Partial<CreatorProject>) => void; deleteProject: (id: string) => void; selectProject: (id: string | null) => void;
  branchSession: (id: string, messageId: string) => string | null;
  rewindUserTurn: (id: string, messageId: string, editedContent?: string) => boolean;
  openSession: (id: string) => void;
  setSessionMode: (id: string, mode: SparkMode) => void;
  updateSession: (id: string, patch: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  appendMessage: (id: string, message: ChatMessage) => void;
  upsertAsset: (asset: BlockAsset) => void;
  upsertVisualAction: (action: VisualAction) => void;
  removeAsset: (id: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  addMemory: (item: MemoryItem) => void;
  updateMemory: (id: string, patch: Partial<MemoryItem>) => void;
  removeMemory: (id: string) => void;
  upsertModel: (model: LocalModel) => void;
  syncCatalog: (models: LocalModel[], folder: string) => void;
  removeModel: (id: string) => void;
  pushEvent: (event: ActivityEvent) => void;
  clearEvents: () => void;
  restore: (workspace: Workspace) => void;
}
const initial = defaultWorkspace();
let hydration:Promise<void>|null=null;
export const useSolarium = create<SolariumState>((set, get) => ({
  webEnabled:false,setWebEnabled:webEnabled=>set({webEnabled}),pendingComposer:null,writingRewrite:null,
  workspace: initial, ready: false, error: null, view: 'home', editingSparkId: null, events: [],
  hydrate: async () => {
    if(get().ready)return;
    if(hydration)return hydration;
    hydration=(async()=>{try { const workspace = await loadWorkspace(); set({ workspace, view: workspace.preferences.startupView ?? 'home', ready: true, error: null }); }
      catch (error) { set({ ready: true, error: `Storage could not be loaded: ${String(error)}` }); }})();
    try{await hydration;}finally{hydration=null;}
  },
  setView: (view) => set({ view }),
  setEditingSparkId: (editingSparkId) => set({ editingSparkId }),
  mutate: (fn) => set((state) => {
    const draft = structuredClone(state.workspace);
    fn(draft);
    return { workspace: draft };
  }),
  addSpark: () => {
    const spark = newSpark();
    get().mutate((w) => { w.sparks.push(spark); w.selectedSparkId = spark.id; });
    set({ view: 'sparks', editingSparkId: spark.id });
  },
  updateSpark: (id, patch) => get().mutate((w) => {
    const spark = w.sparks.find((s) => s.id === id);
    if (spark) Object.assign(spark, patch, { updatedAt: now() });
  }),
  deleteSpark: (id) => get().mutate((w) => {
    if (w.sparks.length <= 1) return;
    w.sparks = w.sparks.filter((s) => s.id !== id);
    w.sessions = w.sessions.filter((s) => s.sparkId !== id);
    w.memories = w.memories.filter((m) => m.sparkId !== id);
    w.worlds = (w.worlds ?? []).filter((m) => m.sparkId !== id);
    w.labCases = (w.labCases ?? []).filter((m) => m.sparkId !== id);
    if (w.selectedSparkId === id) w.selectedSparkId = w.sparks[0]!.id;
    if (w.activeSessionId && !w.sessions.some((s) => s.id === w.activeSessionId)) w.activeSessionId = null;
  }),
  selectSpark: (id) => get().mutate((w) => { if (w.sparks.some((s) => s.id === id)) { w.selectedSparkId = id; w.activeSessionId = null; } }),
  addProject: (name, folder = '', sparkId = null, modelId = null) => { const id = uid(); const project: CreatorProject = { id, name: name.trim().slice(0,120) || 'Untitled project', description: '', instructions: '', folder, sparkId, modelId, createdAt: now(), updatedAt: now() }; get().mutate((w) => { (w.projects ??= []).push(project); w.activeProjectId = id; w.activeSessionId = null; }); set({ view: 'chat', events: [] }); return id; },
  addChannel: (title, projectId, sparkId) => { const channel: ConsoleChannel = { id: uid(), title: title.trim().slice(0,60) || 'My channel', projectId, sparkId, icon: '✦', createdAt: now() }; get().mutate((w) => { (w.preferences.consoleChannels ??= []).push(channel); }); return channel.id; },
  removeChannel: (id) => get().mutate((w) => { w.preferences.consoleChannels = (w.preferences.consoleChannels ?? []).filter((c) => c.id !== id); }),
  openChannel: (id) => { const channel = get().workspace.preferences.consoleChannels?.find((c) => c.id === id); if (!channel) return; get().mutate((w) => { w.activeProjectId = channel.projectId; w.activeSessionId = null; if (channel.sparkId && w.sparks.some((s) => s.id === channel.sparkId)) w.selectedSparkId = channel.sparkId; }); set({ view: 'chat', events: [] }); },
  updateProject: (id, patch) => get().mutate((w) => { const item = (w.projects ?? []).find((p) => p.id === id); if (item) Object.assign(item, patch, { updatedAt: now() }); }),
  deleteProject: (id) => get().mutate((w) => { w.projects = (w.projects ?? []).filter((p) => p.id !== id); const deleted = new Set(w.sessions.filter(s => s.projectId === id).map(s => s.id)); w.visualActions = (w.visualActions ?? []).filter(a => !deleted.has(a.sessionId)); w.sessions = w.sessions.filter((s) => s.projectId !== id); if (w.activeProjectId === id) { w.activeProjectId = null; w.activeSessionId = null; } }),
  selectProject: (id) => { get().mutate((w) => { const project = (w.projects ?? []).find((p) => p.id === id); w.activeProjectId = project?.id ?? null; w.activeSessionId = null; if (project?.sparkId && w.sparks.some((s) => s.id === project.sparkId)) w.selectedSparkId = project.sparkId; }); set({ view: 'chat', events: [] }); },
  createSession: (sparkId, projectId) => {
    const w = get().workspace;
    const project = (w.projects ?? []).find((p) => p.id === (projectId === undefined ? w.activeProjectId : projectId));
    const chosen = sparkId && w.sparks.some((s) => s.id === sparkId) ? sparkId : (project?.sparkId ?? w.selectedSparkId);
    const id = uid();
    const session: ChatSession = { id, sparkId: chosen, modelId: project?.modelId ?? null, projectId: project?.id ?? null, mode: 'conversation', title: 'New conversation', messages: [], createdAt: now(), updatedAt: now() };
    get().mutate((draft) => { draft.sessions.unshift(session); draft.activeSessionId = id; draft.selectedSparkId = chosen; draft.activeProjectId = project?.id ?? null; });
    set({ view: 'chat', events: [] });
    return id;
  },
  branchSession: (id, messageId) => {
    const source = get().workspace.sessions.find((session) => session.id === id);
    if (!source) return null;
    const branch = forkChatSession(source, messageId);
    if (!branch) return null;

    get().mutate((workspace) => {
      workspace.sessions.unshift(branch);
      workspace.activeSessionId = branch.id;
      workspace.selectedSparkId = branch.sparkId; workspace.activeProjectId = branch.projectId ?? null;
    });
    set({ view: 'chat', events: [] });
    return branch.id;
  },
  rewindUserTurn: (id, messageId, editedContent) => {
    const source = get().workspace.sessions.find((session) => session.id === id);
    if (!source) return false;
    const replacement = rewindChatSession(source, messageId, editedContent);
    if (!replacement) return false;
    get().mutate((workspace) => {
      const index = workspace.sessions.findIndex((session) => session.id === id);
      if (index >= 0) workspace.sessions[index] = replacement;
      const retained = new Set(replacement.messages.map(message => message.id));
      workspace.visualActions = (workspace.visualActions ?? []).filter(action => action.sessionId !== id || retained.has(action.messageId));
    });
    set({ events: [] });
    return true;
  },
  openSession: (id) => {
    get().mutate((w) => { const session = w.sessions.find((s) => s.id === id); if (session) { w.activeSessionId = id; w.selectedSparkId = session.sparkId; w.activeProjectId = session.projectId ?? null; } });
    set({ view: 'chat', events: [] });
  },
  setSessionMode: (id, mode) => get().updateSession(id, { mode }),
  updateSession: (id, patch) => get().mutate((w) => { const session = w.sessions.find((s) => s.id === id); if (session) Object.assign(session, patch, { updatedAt: now() }); }),
  deleteSession: (id) => get().mutate((w) => { w.visualActions = (w.visualActions ?? []).filter((a) => a.sessionId !== id); w.sessions = w.sessions.filter((s) => s.id !== id); if (w.activeSessionId === id) w.activeSessionId = null; }),
  appendMessage: (id, message) => get().mutate((w) => {
    const s = w.sessions.find((s) => s.id === id);
    if (s) {
      s.messages.push(message); s.updatedAt = now();
      if (s.title === 'New conversation' && message.role === 'user') s.title = message.content.slice(0, 47).trim() || s.title;
    }
  }),
  upsertVisualAction: (action) => get().mutate((w) => {
    const actions = w.visualActions ??= [];
    const index = actions.findIndex(current => current.id === action.id && current.sessionId === action.sessionId);
    if (index >= 0) actions[index] = action; else actions.push(action);
    if (actions.length > 300) w.visualActions = actions.slice(-300);
  }),
  upsertAsset: (asset) => get().mutate((w) => { const list = (w.assets ??= []); const index = list.findIndex((a) => a.id === asset.id); if (index >= 0) { const previous = list[index]!; const changed = previous.content !== asset.content; list[index] = { ...asset, history: changed ? [...(previous.history ?? []), { content: previous.content, updatedAt: previous.updatedAt }].slice(-20) : previous.history }; } else list.push(asset); }),
  removeAsset: (id) => get().mutate((w) => { w.assets = (w.assets ?? []).filter((a) => a.id !== id); }),
  updatePreferences: (patch) => get().mutate((w) => { w.preferences = { ...w.preferences, ...patch }; }),
  addMemory: (item) => get().mutate((w) => { w.memories.push(item); }),
  updateMemory: (id, patch) => get().mutate((w) => { const m = w.memories.find((m) => m.id === id); if (m) Object.assign(m, patch); }),
  removeMemory: (id) => get().mutate((w) => { w.memories = w.memories.filter((m) => m.id !== id); }),
  upsertModel: (model) => get().mutate((w) => { const i = w.models.findIndex((m) => m.id === model.id); if (i === -1) w.models.push(model); else w.models[i] = model; }),
  syncCatalog: (models, folder) => get().mutate((w) => {
    w.models = mergeCatalog(w.models, models, folder);
    const ids = new Set(w.models.map((m) => m.id));
    for (const session of w.sessions) if (session.modelId && !ids.has(session.modelId)) session.modelId = null;
    for (const spark of w.sparks) if (spark.preferredModelId && !ids.has(spark.preferredModelId)) spark.preferredModelId = null;
  }),
  removeModel: (id) => get().mutate((w) => { w.models = w.models.filter((m) => m.id !== id); w.sparks.forEach((s) => { if (s.preferredModelId === id) s.preferredModelId = null; }); w.sessions.forEach((s) => { if (s.modelId === id) s.modelId = null; }); }),
  pushEvent: (event) => set((s) => {
    if (event.kind === 'operation' || event.kind === 'tool_result') {
      const workspace = structuredClone(s.workspace);
      (workspace.workEvents ??= []).push({ ...event, text: (event.text ?? '').slice(0, 1400) });
      workspace.workEvents = workspace.workEvents.slice(-180);
      // The persisted event is produced by the actual tool dispatcher, not by the LLM's prose.
      // Do not store reasoning deltas as long-term execution history.
      return { workspace, events: [...s.events, event].slice(-200) };
    }
    const last = s.events[s.events.length - 1];
    // Render long reasoning streams as one live item instead of thousands of React nodes.
    if (event.kind === 'reasoning' && last?.kind === 'reasoning' && last.runId === event.runId) {
      return { events: [...s.events.slice(0, -1), {
        ...last, sequence: event.sequence, at: event.at,
        text: `${last.text ?? ''}${event.text ?? ''}`.slice(-20_000),
      }] };
    }
    return { events: [...s.events, event].slice(-200) };
  }),
  clearEvents: () => set({ events: [] }),
  restore: (workspace) => set({ workspace, view: 'chat', editingSparkId: null, events: [] }),
}));
let timer: ReturnType<typeof setTimeout> | undefined;
let saveQueue=Promise.resolve();
useSolarium.subscribe((state, prev) => {
  if (state.ready && state.workspace !== prev.workspace) {
    if(prev.ready&&(prev.workspace.sessions.some(s=>!state.workspace.sessions.some(c=>c.id===s.id))||(prev.workspace.projects??[]).some(p=>!(state.workspace.projects??[]).some(q=>q.id===p.id)))){void cleanupDeletedOwners(prev.workspace,state.workspace).catch(error=>useSolarium.setState({error:`Deleted-owner cleanup failed: ${String(error)}`}));}
    clearTimeout(timer);
    timer = setTimeout(() => {
      const snapshot=useSolarium.getState().workspace;
      saveQueue=saveQueue.catch(()=>{}).then(()=>saveWorkspace(snapshot)).catch((error: unknown) => {
        useSolarium.setState({ error: `Changes could not be saved: ${String(error)}` });
      });
    }, 250);
  }
});
