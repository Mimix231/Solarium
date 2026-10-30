import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, MenuItem, ListSubheader, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { RichMessage } from '../components/RichMessage';
import { BlockWorkbench } from '../blocks/BlockWorkbench';
import { exportBlock } from '../blocks/exports';
import { parseMessageParts, type ContentBlock } from '../blocks/protocol';
import { now as currentIsoTime, type BlockAsset } from '../domain/types';
import { ThinkingPanel, type ThinkingSnapshot } from '../components/ThinkingPanel';
import { ChangesetReview } from '../components/ChangesetReview';
import { LiveWorkspace } from '../components/LiveWorkspace';
import { VisualActionCard } from '../components/VisualActionCard';
import { evolveVisualAction, type VisualAction, type ActionUpdate } from '../engine/visual-actions';
import { workTitle, type LiveWorkspaceUpdate } from '../engine/live-workspace';
import { researchTopic, nativeSearchProvider } from '../research/research';

import { WritingRepository } from '../writing/repository';
import { WritingDraftStream } from '../writing/stream';
import { WritingWorkspace } from '../components/WritingWorkspace';
import { SaveToSources } from '../components/sources/SaveToSources';
import { shouldAutoResearch } from '../engine/task-intent';
import { ACTION_MODE_HELP, taskGrantForTool } from '../engine/action-permissions';
import { readAttachments } from '../engine/creator';
import SendRounded from '@mui/icons-material/SendRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined';
import { AvatarView } from '../components/AvatarView';
import { useSolarium } from '../state/useSolarium';
import { suggestExpression } from '../domain/expressions';
import { now, uid, type ActionMode, type GenerationMetrics, type SparkMode, type Expression, type ChatAttachment, type ChatSource, type TerminalRun } from '../domain/types';
import { runAgent } from '../engine/agent';
import { AgentEventEmitter } from '../engine/activity';
import { activateGGUFModel, scanGGUFDirectory } from '../engine/desktop';
import { catalogToModels } from '../engine/catalog';

const modes: SparkMode[] = ['conversation', 'work', 'research', 'creative'];
type Decision = 'allow' | 'deny';
type ReplyRequest = { kind: 'new' } | { kind: 'retry'; sessionId: string; messageId: string; editedContent?: string };
export function Chat() {
  const { workspace, createSession, appendMessage, setSessionMode, updatePreferences, pushEvent, clearEvents, setView } = useSolarium(useShallow((state) => ({ workspace: state.workspace, createSession: state.createSession, appendMessage: state.appendMessage, setSessionMode: state.setSessionMode, updatePreferences: state.updatePreferences, pushEvent: state.pushEvent, clearEvents: state.clearEvents, setView: state.setView })));
  const spark = workspace.sparks.find((s) => s.id === workspace.selectedSparkId) ?? workspace.sparks[0]!;
  const session = workspace.sessions.find((s) => s.id === workspace.activeSessionId);
  const modelId = session?.modelId ?? spark.preferredModelId ?? workspace.models[0]?.id ?? '';
  const model = workspace.models.find((m) => m.id === modelId);
  const actionMode = workspace.preferences.actionMode ?? 'ask';
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [reaction, setReaction] = useState<Expression | null>(null);
  const [autoReact, setAutoReact] = useState(true);
  const [metrics, setMetrics] = useState<GenerationMetrics | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingTerminalRuns, setPendingTerminalRuns] = useState<TerminalRun[]>([]);
  const [liveMessageId, setLiveMessageId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<{ sessionId: string; messageId: string; block: ContentBlock } | null>(null);
  const [thinking, setThinking] = useState<ThinkingSnapshot | undefined>(undefined);
  const [busyStartedAt, setBusyStartedAt] = useState<number | null>(null);
  const [liveWorkspace, setLiveWorkspace] = useState<LiveWorkspaceUpdate | null>(null);
  const [showLiveWorkspace, setShowLiveWorkspace] = useState(false);
  const [activeActions, setActiveActions] = useState<VisualAction[]>([]);
  const pendingActions = useRef<Map<string,VisualAction>>(new Map());
  const actionOwner = useRef<{sessionId:string;messageId:string}>({sessionId:'pending',messageId:'pending'});
  const currentActionId = useRef<string | null>(null);
  const lastActionFrame = useRef(0);
  function updateAction(update: LiveWorkspaceUpdate) {
    const id = update.operationId ?? `${update.kind}:${update.url ?? update.title}`;
    const owner = actionOwner.current;
    const previous = pendingActions.current.get(id);
    const action = evolveVisualAction(previous, { ...update, operationId:id },
      owner.sessionId, owner.messageId, now());
    pendingActions.current.set(id, action);
    currentActionId.current = id;
    // Updating a huge source buffer on each individual token is unnecessary.
    const time = performance.now();
    if (update.status !== 'running' || time - lastActionFrame.current >= 120) {
      lastActionFrame.current = time;
      setActiveActions([...pendingActions.current.values()]);
    }
    if (owner.sessionId === 'pending' || useSolarium.getState().workspace.activeSessionId === owner.sessionId) updateLiveWorkspace(update);
  }
  function actionList(messageId: string): VisualAction[] {
    const persisted = (workspace.visualActions ?? []).filter(item => item.sessionId === session?.id && item.messageId === messageId);
    if (messageId !== liveMessageId) return persisted;
    return [...persisted, ...activeActions.filter(item => item.id && item.messageId === messageId && item.sessionId === session?.id)];
  }

  const workspaceKey = useRef('');
  const workspaceCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function updateLiveWorkspace(update: LiveWorkspaceUpdate) {
    if (workspaceCloseTimer.current !== null) { clearTimeout(workspaceCloseTimer.current); workspaceCloseTimer.current = null; }
    setLiveWorkspace(update);
    const key = `${update.kind}:${update.activeFile ?? update.url ?? update.title}`;
    if (key !== workspaceKey.current && update.status === 'running' && (['search','writing','inspect','check','execute'].includes(update.kind) || (Boolean(update.files?.length) && ['generate','edit','save'].includes(update.kind)) || update.kind === 'check')) {
      workspaceKey.current = key;
      setShowLiveWorkspace(true);
    }
    if (update.status !== 'running') workspaceCloseTimer.current = setTimeout(() => { setShowLiveWorkspace(false); workspaceCloseTimer.current = null; }, 950);
  }
  const [chatStatus, setChatStatus] = useState<'searching' | 'loading' | 'generating'>('generating');
  const thinkingPhaseStart = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [loadedModel, setLoadedModel] = useState('');
  const [error, setError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const research=useSolarium(state=>state.webEnabled);
  const setWebEnabled=useSolarium(state=>state.setWebEnabled);
  const [writingId,setWritingId]=useState<string|null>(null);
  const [usedSavedSources,setUsedSavedSources]=useState<import('../sources/repository').RetrievedSource[]>([]);
  useEffect(()=>{const prompt=useSolarium.getState().pendingComposer;if(prompt){setInput(prompt);useSolarium.setState({pendingComposer:null});}},[]);
  const [researchStatus, setResearchStatus] = useState('');
  const attachRef = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);
  const [approval, setApproval] = useState<{ name: string; args: Record<string, unknown> } | null>(null);
  const approvalRef = useRef<((value: Decision) => void) | null>(null);
  const controller = useRef<AbortController | null>(null);
  const displayFrame = useRef<number | null>(null);
  const thinkingFrame = useRef<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Do not show another conversation's source when the user switches chats.
    setWritingId(null);setUsedSavedSources([]);setLiveWorkspace(null); setShowLiveWorkspace(false); setActiveActions([]); workspaceKey.current = '';
    if (workspaceCloseTimer.current !== null) clearTimeout(workspaceCloseTimer.current);
  }, [workspace.activeSessionId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [draft, session?.messages.length]);
  useEffect(() => () => {
    controller.current?.abort(); approvalRef.current?.('deny'); approvalRef.current = null;
    if (displayFrame.current !== null) cancelAnimationFrame(displayFrame.current);
    if (thinkingFrame.current !== null) cancelAnimationFrame(thinkingFrame.current);
    if (workspaceCloseTimer.current !== null) clearTimeout(workspaceCloseTimer.current);
  }, []);
  useEffect(() => {
    const folder = workspace.preferences.ggufDirectory;
    if (!folder || !('__TAURI_INTERNALS__' in window)) return;
    let cancelled = false;
    void scanGGUFDirectory(folder).then((files) => {
      if (!cancelled) useSolarium.getState().syncCatalog(catalogToModels(files, useSolarium.getState().workspace.preferences.serverPort), folder);
    }).catch((error: unknown) => { if (!cancelled) setError(`Could not scan your GGUF folder: ${String(error)}`); });
    return () => { cancelled = true; };
  }, [workspace.preferences.ggufDirectory, workspace.preferences.serverPort]);
  async function ensureGGUF(modelToLoad: NonNullable<typeof model>): Promise<NonNullable<typeof model>> {
    if (!modelToLoad.ggufPath) return modelToLoad;
    const preferences = useSolarium.getState().workspace.preferences;
    if (!preferences.llamaExecutable) throw Error('Install llama.cpp first in Models → Inference Engines.');
    const result = await activateGGUFModel({ executable: preferences.llamaExecutable, gguf: modelToLoad.ggufPath,
      port: preferences.serverPort, context: modelToLoad.contextSize, gpuLayers: 20 });
    const ready = { ...modelToLoad, endpoint: `http://127.0.0.1:${preferences.serverPort}`, modelId: result.modelId };
    useSolarium.getState().upsertModel(ready);
    setLoadedModel(result.detail);
    return ready;
  }
  async function changeModel(id: string) {
    if (busy || modelBusy) return;
    const selected = useSolarium.getState().workspace.models.find((m) => m.id === id);
    if (!selected) return;
    const target = useSolarium.getState().workspace.activeSessionId ?? useSolarium.getState().createSession();
    useSolarium.getState().updateSession(target, { modelId: selected.id });
    setLoadedModel(''); setError('');
    if (selected.ggufPath) {
      setModelBusy(true);
      try { await ensureGGUF(selected); }
      catch (error) { setError(`Model loading failed: ${String(error)}`); }
      finally { setModelBusy(false); }
    }
  }
  function answerApproval(value: Decision) {
    approvalRef.current?.(value); approvalRef.current = null; setApproval(null);
  }
  function requestApproval(name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<Decision> {
    if (signal.aborted) return Promise.resolve('deny');
    return new Promise((resolve) => {
      const done = (value: Decision) => { signal.removeEventListener('abort', abort); resolve(value); };
      const abort = () => { approvalRef.current = null; setApproval(null); done('deny'); };
      signal.addEventListener('abort', abort, { once: true });
      approvalRef.current = done; setApproval({ name, args });
    });
  }
  async function attachFiles(files: FileList | File[]) {
    setAttaching(true);
    try { const items = await readAttachments(files); setPendingAttachments((old) => {
      if (old.length + items.length > 8) { setError('Attach a maximum of eight files.'); return old; }
      return [...old, ...items];
    }); setError(''); }
    catch (error) { setError(String(error)); }
    finally { setAttaching(false); }
  }
  function onDrop(event: DragEvent<HTMLElement>) { event.preventDefault(); if (event.dataTransfer.files.length) void attachFiles(event.dataTransfer.files); }
  function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) void attachFiles(event.target.files); event.target.value = ''; }
  async function researchPrompt(text: string, progress: (update: ActionUpdate) => void, emitter: AgentEventEmitter): Promise<{ context: string; sources: ChatSource[] }> {
    if (!research || !shouldAutoResearch(text)) return { context: '', sources: [] };
    const w=useSolarium.getState().workspace;const chat=w.sessions.find(c=>c.id===w.activeSessionId);const project=(w.projects??[]).find(p=>p.id===chat?.projectId);
    const operationId=`research:${emitter.runId}`;
    const signal=controller.current?.signal??new AbortController().signal;
    for(const name of ['search_web','open_web_page']){
      if(w.preferences.toolPermissions[name]==='deny')throw Error(`${name} is blocked in Tool permissions.`);
      if((w.preferences.actionMode??'ask')==='ask'&&await requestApproval(name,{query:text},signal)!=='allow')throw Error('Web research was denied.');
    }
    const provider=await nativeSearchProvider(w.preferences.searchProvider??{kind:'bing'},research);
    const result=await researchTopic(text,`${project?.description??''} ${chat?.messages.filter(m=>m.role==='user').slice(-2).map(m=>m.content.slice(0,300)).join(' ')??''}`,provider,research,signal,candidates=>{
      progress({operationId,kind:'search',status:'running',title:'Researching relevant sources',query:candidates[0]?.query,sources:candidates.map(c=>({title:c.title,url:c.url,excerpt:c.page?.text??c.excerpt,status:c.status})),detail:`${candidates.filter(c=>c.status==='read').length} pages read · ${candidates.length} results`});
    });
    progress({operationId,kind:'search',status:'completed',title:'Research results',query:result.intent.query,sources:result.candidates.map(c=>({title:c.title,url:c.url,excerpt:c.page?.text??c.excerpt,status:c.status})),detail:`${result.candidates.filter(c=>c.status==='read').length} actual pages read`});
    return {context:result.context,sources:result.candidates.map(c=>({title:c.title,url:c.url,excerpt:c.page?.text??c.excerpt,readState:c.status==='read'?'read':'found'}))};
  }
  async function send(request: ReplyRequest = { kind: 'new' }) {
    // Resolve the original turn first: retries must regenerate in the same
    // conversation, with the original attachments and selected model.
    const before = useSolarium.getState().workspace;
    const existing = request.kind === 'retry' ? before.sessions.find((s) => s.id === request.sessionId) : undefined;
    const replySession = existing ?? (request.kind === 'new' ? before.sessions.find((s) => s.id === before.activeSessionId) : undefined);
    const userTurn = request.kind === 'retry' ? existing?.messages.find((m) => m.id === request.messageId && m.role === 'user') : undefined;
    if (request.kind === 'retry' && !userTurn) { setError('The selected user message no longer exists.'); return; }
    const text = (request.kind === 'retry' ? request.editedContent ?? userTurn?.content ?? '' : input).trim();
    const attachments = request.kind === 'retry' ? userTurn?.attachments ?? [] : pendingAttachments;
    if ((!text && !attachments.length) || busy || controller.current || modelBusy || attaching) return;
    const targetSpark = replySession ? before.sparks.find((s) => s.id === replySession.sparkId) ?? spark : spark;
    const targetModelId = replySession?.modelId ?? targetSpark.preferredModelId ?? before.models[0]?.id ?? '';
    const selectedModel = before.models.find((m) => m.id === targetModelId);
    if (!selectedModel) { setError('Select a GGUF model or connect a model before chatting.'); return; }

    const assistantId = uid();
    actionOwner.current = { sessionId: replySession?.id ?? before.activeSessionId ?? 'pending', messageId: assistantId };
    pendingActions.current = new Map(); setActiveActions([]); currentActionId.current = null;
    const abort = new AbortController(); controller.current = abort;
    const willSearch = research && shouldAutoResearch(text);
    workspaceKey.current = ''; setLiveWorkspace(null); setShowLiveWorkspace(false); clearEvents();
    const researchEmitter = new AgentEventEmitter(pushEvent, replySession?.id ?? before.activeSessionId ?? undefined);
    setBusy(true); setBusyStartedAt(performance.now()); setChatStatus(willSearch ? 'searching' : 'loading'); setReaction(null);
    thinkingPhaseStart.current = null;
    if (willSearch) setResearchStatus('Searching and reading public websites…');
    let web: { context: string; sources: ChatSource[] } = { context: '', sources: [] };
    try { web = await researchPrompt(text, updateAction, researchEmitter); }
    catch (error) {
      if (!abort.signal.aborted) setError(`Web research failed: ${String(error)}`);
      controller.current = null; setBusy(false); setBusyStartedAt(null); setResearchStatus(''); return;
    } finally { setResearchStatus(''); }
    if (abort.signal.aborted) { controller.current = null; setBusy(false); setBusyStartedAt(null); return; }
    setChatStatus('loading'); setShowLiveWorkspace(false);
    try { await ensureGGUF(selectedModel); }
    catch (error) {
      if (!abort.signal.aborted) setError(`Cannot load model: ${String(error)}`);
      controller.current = null; setBusy(false); setBusyStartedAt(null); return;
    }
    if (abort.signal.aborted) { controller.current = null; setBusy(false); setBusyStartedAt(null); return; }

    const current = useSolarium.getState();
    const targetId = request.kind === 'retry' ? request.sessionId : current.workspace.activeSessionId ?? current.createSession();
    if (request.kind === 'retry') {
      // Only discard the old response after the model is ready. A failed
      // load/search leaves all previous messages intact.
      if (!current.rewindUserTurn(targetId, request.messageId, request.editedContent)) {
        controller.current = null; setBusy(false); setBusyStartedAt(null);
        setError('Cannot retry this message. Refresh the conversation and try again.'); return;
      }
      setEditingMessageId(null); setEditingText('');
    } else {
      current.appendMessage(targetId, { id: uid(), role: 'user', content: text, attachments, createdAt: now() });
      setInput(''); setPendingAttachments([]);
    }
    if (actionOwner.current.sessionId === 'pending') {
      actionOwner.current.sessionId = targetId;
      for (const [id, action] of pendingActions.current) pendingActions.current.set(id, {...action, sessionId: targetId});
      setActiveActions([...pendingActions.current.values()]);
    }
    const updated = useSolarium.getState().workspace;
    const chat = updated.sessions.find((s) => s.id === targetId);
    if (!chat) {
      controller.current = null; setBusy(false); setBusyStartedAt(null); setError('Could not locate the conversation.'); return;
    }
    const activeSpark = updated.sparks.find((s) => s.id === chat.sparkId) ?? targetSpark;
    const activeModel = updated.models.find((m) => m.id === (chat.modelId ?? activeSpark.preferredModelId ?? updated.models[0]?.id)) ?? selectedModel;
    setChatStatus('generating'); setMetrics(null); setThinking(undefined); setDraft(''); setError('');
    const events = new AgentEventEmitter(pushEvent, targetId);
    setLiveMessageId(assistantId);
    let completed = '';
    const writingRepo=new WritingRepository({sessionId:targetId,projectId:chat.projectId??null});
    const writingStream=new WritingDraftStream(writingRepo,chat.projectId?{kind:'project',id:chat.projectId}:{kind:'chat',id:targetId},assistantId,chat.storyId??null,error=>setError(`Draft checkpoint failed: ${String(error)}`));
    const rewrite=useSolarium.getState().writingRewrite;
    const terminalRuns: TerminalRun[] = [];
    setPendingTerminalRuns([]);
    let thinkingSnapshot: ThinkingSnapshot | undefined;
    let generationWarning: string | undefined;
    let suppliedSources:import('../sources/repository').RetrievedSource[]=[];
    const researchSources = new Map(web.sources.map((source) => [source.url, source]));
    try {
      completed = await runAgent({
        spark: activeSpark, model: activeModel, session: chat,
        memories: updated.memories, worlds: updated.worlds ?? [], preferences: updated.preferences, events, signal: abort.signal,
        supplementalContext: web.context, projects: updated.projects ?? [],
        onSource: (source) => { researchSources.set(source.url, source); },
        messageId:assistantId,onStory:id=>useSolarium.getState().updateSession(targetId,{storyId:id}),onSavedSources:refs=>{suppliedSources=refs;setUsedSavedSources(refs);},
        onWorkspace: updateAction,
        onMetrics: setMetrics, webEnabled: research,
        onWarning: (message) => { generationWarning = message; },
        onTerminal: (record) => { terminalRuns.push(record); setPendingTerminalRuns([...terminalRuns]); },
        onThinking: (state) => {
          if (state.active && thinkingPhaseStart.current === null) thinkingPhaseStart.current = performance.now();
          const snapshot = { ...state, activeStartedAt: state.active ? thinkingPhaseStart.current ?? undefined : undefined };
          if (!state.active) thinkingPhaseStart.current = null;
          thinkingSnapshot = snapshot;
          if (thinkingFrame.current === null) thinkingFrame.current = requestAnimationFrame(() => { thinkingFrame.current = null; setThinking(thinkingSnapshot); });
        },
        onAnswer: (delta) => {
          completed += delta;
          writingStream.push(delta);
          if (displayFrame.current === null) displayFrame.current = requestAnimationFrame(() => {
            displayFrame.current = null; setDraft(completed);
            if (completed.includes('```solarium-writing')) for (const part of parseMessageParts(completed)) {
              if (part.type !== 'block' || part.block.kind !== 'writing') continue;
              updateAction({ operationId:`document:${assistantId}:${part.block.id}`, kind:'writing',
                status:part.block.status === 'complete' ? 'completed' : 'running',
                title:workTitle('writing',part.block.title),
                detail:part.block.status === 'complete' ? 'Document draft generated in chat; not saved to a file.' : 'Streaming document draft · not saved to disk',
                output:part.block.content });
            }
          });
        },
        onApproval: (name, args) => requestApproval(name, args, abort.signal),
      });
    } catch (e) {
      if (!abort.signal.aborted) { events.emit('error', String(e)); setError(String(e)); }
    } finally {
      let autoCategory:string|null|undefined;
      if(!abort.signal.aborted&&/\b(save|store)\b/i.test(text)&&/\b(chapter|document|story|essay|article)\b/i.test(text)){
        const categoryMatch=/\b(?:save|store)\b.{0,50}?\b(?:under|to|in)\s+["“]?([^"”\n.]{2,160})/i.exec(text);
        try{autoCategory=categoryMatch?await writingRepo.ensureCategoryPath(categoryMatch[1]!.replace(/\s+category$/i,''),chat.projectId?{kind:'project',id:chat.projectId}:{kind:'chat',id:targetId},chat.storyId??null):null;}catch(error){setError(String(error));}
      }
      await writingStream.finish(abort.signal.aborted,autoCategory);
      if(rewrite&&completed.trim()&&!abort.signal.aborted){const parts=parseMessageParts(completed);const block=parts.find(p=>p.type==='block'&&p.block.kind==='writing');useSolarium.setState({writingRewrite:{...rewrite,replacement:block?.type==='block'?block.block.content:completed.trim()}});}
      if (completed.includes('```solarium-writing')) for (const part of parseMessageParts(completed)) {
        if (part.type !== 'block' || part.block.kind !== 'writing') continue;
        updateAction({operationId:`document:${assistantId}:${part.block.id}`,kind:'writing',
          status:part.block.status === 'complete' ? 'completed' : 'failed',title:workTitle('writing',part.block.title),
          detail:part.block.status === 'complete' ? 'Document draft generated in chat; not saved to a file.' : 'Document generation stopped before the closing fence.', output:part.block.content});
      }
      if (completed.trim()) { if (autoReact) setReaction(suggestExpression(completed)); }
      if (completed.trim() || thinkingSnapshot?.text || pendingActions.current.size) appendMessage(targetId, { id: assistantId, role: 'assistant', content: completed, savedSourceRefs:suppliedSources.map(r=>({id:r.sourceId,title:r.title})), sources: [...researchSources.values()], terminalRuns, sparkId: activeSpark.id, ...(generationWarning ? { generationWarning } : {}), ...(thinkingSnapshot?.text ? { reasoning: thinkingSnapshot.text, reasoningMs: thinkingSnapshot.elapsedMs } : {}), createdAt: now() });
      for (const action of pendingActions.current.values()) {
        useSolarium.getState().upsertVisualAction(action.status === 'running' ? {...action, status:'failed', detail:`${action.detail}\nExecution stopped without a confirmed result.`} : action);
      }
      pendingActions.current = new Map(); setActiveActions([]);
      if (displayFrame.current !== null) { cancelAnimationFrame(displayFrame.current); displayFrame.current = null; }
      if (thinkingFrame.current !== null) { cancelAnimationFrame(thinkingFrame.current); thinkingFrame.current = null; }
      if (workspaceCloseTimer.current !== null) { clearTimeout(workspaceCloseTimer.current); workspaceCloseTimer.current = null; }
      controller.current = null; setBusy(false); setShowLiveWorkspace(false); setBusyStartedAt(null); setDraft(''); setLiveMessageId(null); setPendingTerminalRuns([]); setThinking(undefined); setApproval(null);
    }
  }
  function assetKey(sessionId: string, messageId: string, blockId: string): string {
    return `${sessionId}:${messageId}:${blockId}`;
  }
  function blockAssets(messageId: string): Record<string, string> {
    return Object.fromEntries((workspace.assets ?? []).filter((asset) => asset.sessionId === session?.id && asset.messageId === messageId)
      .map((asset) => [asset.blockId, asset.content]));
  }
  function openBlock(messageId: string, block: ContentBlock) {
    if (!session) return;
    if(block.kind==='writing'){void openWriting(messageId,block);return;}
    setSelectedBlock({ sessionId: session.id, messageId, block });
  }
  async function openWriting(messageId:string,block:ContentBlock){
    if(!session)return;try{const repo=new WritingRepository({sessionId:session.id,projectId:session.projectId??null});const found=(await repo.list()).find(d=>d.data.originConversationId===session.id&&d.data.originMessageId===messageId&&d.data.legacyBlockId===block.id);
      const asset=(workspace.assets??[]).find(a=>a.sessionId===session.id&&a.messageId===messageId&&a.blockId===block.id);
      const doc=found??await repo.create({scope:session.projectId?{kind:'project',id:session.projectId}:{kind:'chat',id:session.id},title:block.title,markdown:asset?.content??block.content,storyId:session.storyId??null,messageId,legacyBlockId:block.id});setWritingId(doc.id);
    }catch(error){setError(String(error));}
  }
  function saveBlock(messageId: string, block: ContentBlock) {
    if (!session || block.status === 'streaming') return;
    if(block.kind==='writing'){void openWriting(messageId,block);return;}
    const id = assetKey(session.id, messageId, block.id);
    const previous = (useSolarium.getState().workspace.assets ?? []).find((a) => a.id === id);
    const asset: BlockAsset = {
      id, sessionId: session.id, messageId, blockId: block.id, projectId: session.projectId ?? null,
      kind: block.kind, title: block.title, language: block.language,
      content: block.content, createdAt: previous?.createdAt ?? currentIsoTime(), updatedAt: currentIsoTime(),
    };
    useSolarium.getState().upsertAsset(asset);
  }
  const openMessage = selectedBlock && workspace.sessions.find((s) => s.id === selectedBlock.sessionId)?.messages.find((m) => m.id === selectedBlock.messageId);
  const openText = openMessage?.content ?? (selectedBlock?.messageId === liveMessageId && busy ? draft : '');
  const matchingBlock = selectedBlock && parseMessageParts(openText).find((part) => part.type === 'block' && part.block.id === selectedBlock.block.id);
  const storedAsset = (workspace.assets ?? []).find((asset) => selectedBlock && asset.id === assetKey(selectedBlock.sessionId, selectedBlock.messageId, selectedBlock.block.id));
  const activeBlock = matchingBlock?.type === 'block' ? matchingBlock.block : selectedBlock?.block;
  const editorBlock = activeBlock ? { ...activeBlock, ...(storedAsset ? { content: storedAsset.content } : {}) } : null;
  async function copyUserMessage(text: string) {
    try { await navigator.clipboard.writeText(text); }
    catch { setError('Could not copy the message. Check clipboard permissions.'); }
  }
  function retryUserMessage(messageId: string, editedContent?: string) {
    if (!session || busy || modelBusy) return;
    if (editedContent !== undefined && !editedContent.trim()) { setError('A user message cannot be empty.'); return; }
    void send({ kind: 'retry', sessionId: session.id, messageId, editedContent });
  }
  function keydown(e: KeyboardEvent<HTMLDivElement>) { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }
  return <div className="chat-layout" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
    <section className="chat-primary">
      <div className="chat-header">
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}><AvatarView avatar={reaction ? { ...spark.avatar, expression: reaction } : spark.avatar} size={31} active={busy} /><Stack minWidth={0}><Typography fontSize={12.5} fontWeight={750} noWrap>{spark.name}</Typography><Typography color="text.secondary" fontSize={10} noWrap>{model ? `${model.name} · ${model.backend ?? 'llama.cpp'}` : 'No model connected'}</Typography></Stack><span className={`status-dot ${model ? 'ready-dot' : ''}`} /></Stack>
        <Stack direction="row" alignItems="center" gap={.8}>
          <FormControl size="small" className="mode-select"><Select aria-label="Conversation mode" disabled={busy} value={session?.mode ?? 'conversation'} onChange={(e) => { if (session) setSessionMode(session.id, e.target.value as SparkMode); else setSessionMode(createSession(), e.target.value as SparkMode); }} sx={{ fontSize: 11 }}>{modes.map((mode) => <MenuItem key={mode} value={mode}>{mode[0]?.toUpperCase()}{mode.slice(1)}</MenuItem>)}</Select></FormControl>
          {metrics && <Tooltip title={`First token ${metrics.firstTokenMs?.toFixed(0) ?? '—'} ms · ${metrics.completionTokens === null ? 'estimated' : 'reported'} output tokens`}><Chip size="small" variant="outlined" label={`${metrics.tokensPerSecond ?? '—'} tok/s${metrics.completionTokens === null ? ' ≈' : ''}`} /></Tooltip>}
          <Tooltip title="Toggle lightweight avatar reaction from completed text"><Button size="small" variant="text" onClick={() => { setAutoReact((v) => !v); setReaction(null); }} sx={{ fontSize: 10 }}>{autoReact ? 'Expressions on' : 'Expressions off'}</Button></Tooltip>
          <Button size="small" onClick={() => setLibraryOpen(true)}>Assets ({(workspace.assets ?? []).length})</Button>
          <Tooltip title="New conversation"><IconButton aria-label="New conversation" disabled={busy} onClick={() => createSession()}><AddRounded fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </div>
      {liveWorkspace && <Button size="small" onClick={() => setShowLiveWorkspace((visible) => !visible)}
        sx={{ alignSelf: 'flex-end', mr: 1, my: .3, fontSize: 10 }}>{showLiveWorkspace ? 'Return to conversation' : `Show live ${liveWorkspace.kind} workspace`}</Button>}
      {liveWorkspace && showLiveWorkspace ? <div className="live-workspace-container"><LiveWorkspace update={liveWorkspace} onReturn={() => setShowLiveWorkspace(false)}/></div> : <div className="message-list" role="log" aria-live="polite">
        {!session?.messages.length && <div className="welcome">
          <div className="welcome-orbit"><AvatarView avatar={reaction ? { ...spark.avatar, expression: reaction } : spark.avatar} size={94} /></div>
          <span className="eyebrow">YOUR AI COMPANION</span>
          <Typography variant="h5" mt={1}>A universe of possibilities.</Typography>
          <Typography color="text.secondary" mt={1} fontSize={13} maxWidth={440} textAlign="center">{spark.greeting}</Typography>
          <Stack direction="row" gap={1} justifyContent="center" flexWrap="wrap" mt={3}>
            {['Explore an idea', 'Help me write code', 'Brainstorm something new'].map((prompt) => <button key={prompt} className="prompt-chip" onClick={() => setInput(prompt)}>{prompt} ↗</button>)}
          </Stack>
          <Stack direction="row" gap={1} mt={3} flexWrap="wrap" justifyContent="center">
            <Button onClick={() => setView('sparks')} startIcon={<AutoAwesomeRounded />}>Customize Spark</Button>
            {!model && <Button onClick={() => setView('models')} startIcon={<SmartToyOutlined />} variant="contained">Connect a model</Button>}
          </Stack>
        </div>}
        {session?.messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}>
          {message.role === 'assistant' && <AvatarView avatar={workspace.sparks.find((s) => s.id === message.sparkId)?.avatar ?? spark.avatar} size={26} />}
          <div className="message-content">
            {message.role === 'user' ? <>
              <div className="user-message-bubble">
                <Typography fontWeight={700} fontSize={11} color="text.secondary" mb={.45}>You</Typography>
                {editingMessageId === message.id ? <Stack gap={1}>
                  <TextField aria-label="Edit user message" multiline minRows={2} maxRows={12} autoFocus fullWidth size="small"
                    value={editingText} onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.preventDefault(); setEditingMessageId(null); }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); retryUserMessage(message.id, editingText); }
                    }} sx={{ '& .MuiInputBase-root': { fontSize: 12.5 } }}/>
                  <Stack direction="row" justifyContent="flex-end" gap={.7}>
                    <Button size="small" disabled={busy || modelBusy} onClick={() => { setEditingMessageId(null); setEditingText(''); }}>Cancel</Button>
                    <Button size="small" variant="contained" disabled={!editingText.trim() || busy || modelBusy} startIcon={<CheckRounded sx={{ fontSize: 14 }}/>} onClick={() => retryUserMessage(message.id, editingText)}>Save & retry</Button>
                  </Stack>
                </Stack> : <><RichMessage text={message.content} attachments={message.attachments} sources={message.sources} assets={blockAssets(message.id)} terminalRuns={message.terminalRuns} onOpenBlock={(block) => openBlock(message.id, block)} onSaveAsset={(block) => saveBlock(message.id, block)}/>{session&&<SaveToSources text={message.content} origin={{kind:'message',sessionId:session.id,messageId:message.id}} access={{sessionId:session.id,projectId:session.projectId??null}} projectName={(workspace.projects??[]).find(p=>p.id===session.projectId)?.name}/>}</>}
              </div>
              <div className="user-message-actions" aria-label="User message actions">
                <Tooltip title="Copy this message"><span><Button aria-label="Copy user message" size="small" startIcon={<ContentCopyRounded sx={{ fontSize: 13 }}/>} onClick={() => void copyUserMessage(message.content)}>Copy</Button></span></Tooltip>
                <Tooltip title="Edit this message and generate a new reply"><span><Button aria-label="Edit user message" size="small" disabled={busy || modelBusy || editingMessageId === message.id} startIcon={<EditOutlined sx={{ fontSize: 13 }}/>} onClick={() => { setEditingMessageId(message.id); setEditingText(message.content); setError(''); }}>Edit</Button></span></Tooltip>
                <Tooltip title="Remove later messages and regenerate the answer"><span><Button aria-label="Retry user message" size="small" disabled={busy || modelBusy || editingMessageId === message.id} startIcon={<ReplayRounded sx={{ fontSize: 13 }}/>} onClick={() => retryUserMessage(message.id)}>Retry</Button></span></Tooltip>
                <Button size="small" disabled={busy} onClick={() => { if (session) useSolarium.getState().branchSession(session.id, message.id); }} title="Create an independent conversation from this message">↳ Branch</Button>
              </div>
            </> : <>
              <Typography fontWeight={700} fontSize={11} color="text.secondary" mb={.45}>{workspace.sparks.find((s) => s.id === message.sparkId)?.name ?? spark.name}</Typography>
              {actionList(message.id).map(action => <VisualActionCard key={action.id} action={action} onExpandWorkspace={(selected) => { setLiveWorkspace(selected); setShowLiveWorkspace(true); }}/>) }
              <ThinkingPanel snapshot={message.reasoning ? { text: message.reasoning, elapsedMs: message.reasoningMs ?? 0, active: false } : undefined}/>
              <RichMessage text={message.content} attachments={message.attachments} sources={message.sources} assets={blockAssets(message.id)} terminalRuns={message.terminalRuns} onOpenBlock={(block) => openBlock(message.id, block)} onSaveAsset={(block) => saveBlock(message.id, block)}/>{session&&<SaveToSources text={message.content} origin={{kind:'message',sessionId:session.id,messageId:message.id}} access={{sessionId:session.id,projectId:session.projectId??null}} projectName={(workspace.projects??[]).find(p=>p.id===session.projectId)?.name}/>}
              {Boolean(message.savedSourceRefs?.length)&&<Button size="small" onClick={()=>setView('sources')}>Saved references supplied: {message.savedSourceRefs!.map(r=>r.title).join(', ')}</Button>}
              {message.generationWarning && <Typography className="generation-warning" title={message.generationWarning} fontSize={10} color="text.secondary">◌ Response may be incomplete · {message.generationWarning}</Typography>}
              <Button sx={{ mt: .35, opacity: .7, fontSize: 10 }} size="small" disabled={busy} onClick={() => { if (session) useSolarium.getState().branchSession(session.id, message.id); }} title="Create an independent conversation from this message">↳ Branch from here</Button>
            </>}
          </div>
        </div>)}
        {usedSavedSources.length>0&&busy&&<Typography fontSize={10} color="text.secondary">Saved references supplied: {usedSavedSources.map(s=>s.title).join(', ')}</Typography>}
        {busy && <div className="message-row assistant"><AvatarView avatar={reaction ? { ...spark.avatar, expression: reaction } : spark.avatar} size={26} active /><div className="message-content"><Typography fontSize={11} fontWeight={700} mb={.6}>{spark.name} <CircularProgress size={10} sx={{ ml: .8 }} /></Typography><ThinkingPanel snapshot={thinking} busy busyStartedAt={busyStartedAt} status={chatStatus}/>{activeActions.filter(action => action.messageId === liveMessageId && action.sessionId === session?.id).map(action => <VisualActionCard key={action.id} action={action} onExpandWorkspace={(selected) => { setLiveWorkspace(selected); setShowLiveWorkspace(true); }}/>) }<RichMessage streaming text={draft || researchStatus || ''} terminalRuns={pendingTerminalRuns} onOpenBlock={liveMessageId ? (block) => openBlock(liveMessageId, block) : undefined}/></div></div>}
        <div ref={bottom} />
      </div>}
      <div className="composer-wrap">
        {error && <Alert severity="warning" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}
        <div className="composer-model-row">
          <FormControl size="small" sx={{ minWidth: 225, maxWidth: '85%' }}>
            <Select variant="standard" disableUnderline size="small" aria-label="Choose GGUF or connected model" disabled={busy || modelBusy}
              displayEmpty value={modelId} onChange={(e) => void changeModel(e.target.value)} sx={{ fontSize: 11 }}>
              {!workspace.models.length && <MenuItem value="" disabled>Set a GGUF folder in Settings</MenuItem>}
              {workspace.models.some((m) => m.ggufPath) && <ListSubheader>GGUF models in your folder</ListSubheader>}
              {workspace.models.filter((m) => m.ggufPath).map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
              {workspace.models.some((m) => !m.ggufPath) && <ListSubheader>Other local servers</ListSubheader>}
              {workspace.models.filter((m) => !m.ggufPath).map((m) => <MenuItem key={m.id} value={m.id}>{m.name} · {m.backend ?? 'llama.cpp'}</MenuItem>)}
            </Select>
          </FormControl>
          {modelBusy ? <Stack direction="row" gap={.7} alignItems="center"><CircularProgress size={11}/><Typography fontSize={10}>Loading GGUF…</Typography></Stack> : <Typography color="text.secondary" fontSize={10} noWrap>{loadedModel || (model?.ggufPath ? 'Select to load · local GGUF' : (model ? model.backend : 'No GGUF folder configured'))}</Typography>}
          <Button size="small" onClick={() => setView('settings')} sx={{ ml: 'auto' }}>Library settings</Button>
        </div>
        {workspace.activeProjectId && <Button size="small" startIcon={<FolderOpenRounded fontSize="small"/>} onClick={() => setView('projects')} sx={{ mb: .5 }}>
          Project: {(workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId)?.name ?? 'Unknown project'} · {(workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId)?.folder ? 'Source folder linked' : 'No source folder — link in Project Settings'}
        </Button>}
        {workspace.activeProjectId && Boolean((workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId)?.folder) && model?.toolCalling !== true &&
          <Button size="small" color="warning" onClick={() => setView('models')} sx={{ mb: .4, fontSize: 10 }}>Need Dona to edit files? Check this GGUF's tool-calling support in Models →</Button>}
        {pendingAttachments.length > 0 && <Stack direction="row" gap={.7} flexWrap="wrap" mb={.7}>{pendingAttachments.map((a) => <Chip key={a.id} size="small" label={`${a.kind === 'image' ? '▧ ' : '▤ '}${a.name}`} onDelete={() => setPendingAttachments((items) => items.filter((i) => i.id !== a.id))}/>)}</Stack>}
        <Stack direction="row" gap={1} mb={.6} alignItems="center" flexWrap="wrap">
          <Tooltip title={ACTION_MODE_HELP[actionMode]} arrow>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select value={actionMode} variant="standard" disableUnderline disabled={busy || modelBusy} aria-label="Tool execution mode"
                onChange={(event) => updatePreferences({ actionMode: event.target.value as ActionMode })}
                sx={{ fontSize: 11, fontWeight: 700, color: actionMode === 'yolo' ? 'warning.main' : 'text.primary', px: .75, border: '1px solid var(--line)', borderRadius: 1 }}>
                <MenuItem value="ask">Ask</MenuItem>
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="yolo">YOLO</MenuItem>
              </Select>
            </FormControl>
          </Tooltip>
          {actionMode === 'yolo' && <Typography fontSize={10} color="warning.main" title={ACTION_MODE_HELP.yolo}>No approval prompts · trusted projects only</Typography>}
          <input ref={attachRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,.txt,.md,.pdf,.docx,.ts,.tsx,.js,.jsx,.json,.css,.html,.py,.rs,.go,.java,.cpp,.xml,.yml,.yaml,.toml,.sql,.csv,.log,.svg" onChange={onAttachmentChange}/>
          <Button size="small" disabled={busy || attaching} startIcon={<AttachFileRounded sx={{ fontSize: 15 }}/>} onClick={() => attachRef.current?.click()}>{attaching ? 'Reading…' : 'Attach files'}</Button>
          <Button size="small" color={research ? 'primary' : 'inherit'} variant={research ? 'contained' : 'text'} startIcon={<TravelExploreRounded sx={{ fontSize: 15 }}/>} onClick={() => setWebEnabled(!research)} disabled={busy}>{research ? 'Web search on' : 'Web search off'}</Button>
          <Typography color="text.secondary" fontSize={10}>Drop images, PDFs, DOCX, or source files here</Typography></Stack>
        <div className="composer glass"><TextField placeholder={`Message ${spark.name}…`} variant="standard" fullWidth multiline maxRows={8} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={keydown} disabled={busy || modelBusy} slotProps={{ input: { disableUnderline: true } }} />
          {busy ? <Tooltip title="Stop generation"><IconButton aria-label="Stop generation" className="send-button" onClick={() => { controller.current?.abort(); answerApproval('deny'); }}><StopRounded /></IconButton></Tooltip> : <Tooltip title="Send (Enter)"><span><IconButton aria-label="Send message" className="send-button" disabled={(!input.trim() && !pendingAttachments.length) || modelBusy || attaching} onClick={() => void send()}><SendRounded /></IconButton></span></Tooltip>}
        </div>
        <Typography color="text.secondary" textAlign="center" fontSize={10} mt={.7}>Your Sparks run on local models. Verify important information.</Typography>

      </div>
    </section>
    {writingId&&session&&<WritingWorkspace documentId={writingId} access={{sessionId:session.id,projectId:session.projectId??null}} onClose={()=>setWritingId(null)}/>}
    {editorBlock && selectedBlock?.sessionId === session?.id && <BlockWorkbench block={editorBlock} onClose={() => setSelectedBlock(null)} onSave={(block) => { if (selectedBlock) saveBlock(selectedBlock.messageId, block); }} onRewrite={(excerpt, document) => { setInput(`Rewrite only the selected passage from "${document.title}" while preserving its style and continuity. Return the revised passage, not the entire chapter.\n\n${excerpt}`); setSelectedBlock(null); }} projectFolder={(workspace.projects ?? []).find((p) => p.id === session?.projectId)?.folder || undefined} history={storedAsset?.history}/>}

    <Dialog open={libraryOpen} onClose={() => setLibraryOpen(false)} fullWidth maxWidth="sm"><DialogTitle fontSize={14}>Saved content assets</DialogTitle><DialogContent><Stack gap={.8}>
      {(workspace.assets ?? []).filter((asset) => (asset.projectId ?? null) === (workspace.activeProjectId ?? null)).map((asset) => <Stack key={asset.id} direction="row" alignItems="center" gap={1} sx={{ border: '1px solid var(--line)', borderRadius: 2, px: 1, py: .7 }}>
        <Typography minWidth={0} noWrap sx={{ flex: 1 }} fontSize={11}>{asset.title} · {asset.kind}</Typography>
        <Button size="small" onClick={() => { const owner = workspace.sessions.find((s) => s.id === asset.sessionId); if (owner) useSolarium.getState().openSession(owner.id); setSelectedBlock({ sessionId: asset.sessionId, messageId: asset.messageId, block: { id: asset.blockId, kind: asset.kind, title: asset.title, language: asset.language, content: asset.content, status: 'complete', provenance: 'model' } }); setLibraryOpen(false); }}>Open</Button>
        <Button size="small" onClick={() => exportBlock({ id: asset.blockId, kind: asset.kind, title: asset.title, language: asset.language, content: asset.content, status: 'complete', provenance: 'model' })}>Export</Button>
        <Button size="small" color="error" onClick={() => { if (window.confirm(`Delete saved asset "${asset.title}"? Conversation text will stay intact.`)) useSolarium.getState().removeAsset(asset.id); }}>Delete</Button>
      </Stack>)}
      {!(workspace.assets ?? []).some((asset) => (asset.projectId ?? null) === (workspace.activeProjectId ?? null)) && <Typography fontSize={12} color="text.secondary">Open a generated code or writing block and choose Save asset. Your assets stay available after restarting Solarium.</Typography>}
    </Stack></DialogContent><DialogActions><Button onClick={() => setLibraryOpen(false)}>Close</Button></DialogActions></Dialog>
    <Dialog open={Boolean(approval)} onClose={() => answerApproval('deny')} fullWidth maxWidth={['apply_project_changes','replace_project_text'].includes(approval?.name ?? '') ? 'md' : 'xs'}><DialogTitle fontSize={15}>Allow local tool?</DialogTitle><DialogContent><Typography mb={1} fontWeight={700}>{approval?.name}</Typography>{['apply_project_changes','replace_project_text'].includes(approval?.name ?? '')
        ? <><Typography fontSize={11} color="text.secondary">Review the proposed source changes. Nothing is written until you approve.</Typography><ChangesetReview args={approval?.args ?? {}}/></>
        : <Typography color="text.secondary" fontSize={12} sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{JSON.stringify(approval?.args ?? {}, null, 2)}</Typography>}<Typography color="text.secondary" fontSize={11} mt={2}>{actionMode === 'auto' && approval && taskGrantForTool(approval.name, approval.args)
        ? `Approving grants ${taskGrantForTool(approval.name, approval.args) === 'write' ? 'project-file edits' : 'project checks'} for this reply only. Other tasks still require permission.`
        : 'This tool runs only after your approval.'}</Typography></DialogContent><DialogActions><Button onClick={() => answerApproval('deny')}>Deny</Button><Button variant="contained" onClick={() => answerApproval('allow')}>{actionMode === 'auto' && approval && taskGrantForTool(approval.name, approval.args) ? 'Allow for this task' : 'Allow once'}</Button></DialogActions></Dialog>
  </div>;
}
