import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { ContentBlock } from '../blocks/protocol';
import type { AccessContext } from '../foundation/types';
import type { WritingDocument } from '../writing/types';
import { WritingRepository, wordCount, writingRevisionChanged } from '../writing/repository';
import { markdownContent, structuredContent, writingExtensions } from '../writing/schema';
import { downloadBytes, exportDocx } from '../blocks/exports';
import { readableProse, repeatedPassages } from '../writing/prose';
import { ChapterProse, ChapterReader } from './ChapterReader';
import { useSolarium } from '../state/useSolarium';
import { canonPointLabel } from '../stories/canon';

export interface WritingBlockContext {
  access: AccessContext;
  messageId: string;
  documentId?: string;
  storyId?: string | null;
  activeChapter?: { documentId: string; messageId: string };
}
export function InlineWritingBlock({ block, context, onAdvanced }: { block: ContentBlock; context: WritingBlockContext; onAdvanced?: () => void }) {
  const spacer = useSolarium(state => state.workspace.preferences.sceneSpacer ?? 'rule');
  const repo = useMemo(() => new WritingRepository({sessionId:context.access.sessionId,projectId:context.access.projectId}), [context.access.sessionId, context.access.projectId]);
  const [saved, setSaved] = useState<{ document: WritingDocument; markdown: string } | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [readFull, setReadFull] = useState(false);
  const locatedDocument = saved?.document.id;
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (block.status === 'streaming') return;
    let disposed = false;
    const load = async () => {
      const doc = (await repo.list()).find(d => context.documentId?d.id===context.documentId:(d.data.originMessageId === context.messageId || d.data.messageBindings?.includes(context.messageId)) && (d.data.legacyBlockId === block.id || !d.data.legacyBlockId && d.title === block.title));
      if (!doc) return;
      const result = await repo.get(doc.id);
      const draft = doc.data.status !== 'final' ? await repo.draft(doc.id) : null;
      if (disposed) return;
      setSaved(old => old?.document.id === doc.id && old.document.version === result.document.version ? old :
        { document: result.document, markdown: result.content.markdownProjection });
      setRecovery(draft && draft.baseRevisionId === result.document.data.currentRevisionId && draft.status !== 'generating' &&
        draft.markdown.trim() !== result.content.markdownProjection.trim() && draft.markdown.trim() ? draft.markdown : null);
    };
    void load().catch(e => !disposed && setError(String(e)));
    const refresh = () => { if (!editing) void load().catch(e => !disposed && setError(String(e))); };
    const onRevision = (event: Event) => {
      if ((event as CustomEvent<string>).detail === (context.documentId ?? locatedDocument)) refresh();
    };
    window.addEventListener(writingRevisionChanged, onRevision);
    window.addEventListener('focus', refresh);
    const timer = !editing && !locatedDocument ? setTimeout(refresh, 700) : undefined;
    return () => { disposed = true; window.removeEventListener(writingRevisionChanged, onRevision); window.removeEventListener('focus', refresh); if (timer) clearTimeout(timer); };
  }, [repo, context.messageId, context.documentId, block.id, block.title, block.status, editing, locatedDocument]);
  const original = block.status === 'streaming' ? block.content : recovery ?? saved?.markdown ?? block.content;
  const presentation=useMemo(()=>readableProse(original),[original]);
  const text=presentation.text;
  const repeated=useMemo(()=>block.status==='streaming'||saved?.document.data.metadata.writingTaskId&&!recovery?[]:repeatedPassages(text),[text,block.status,saved,recovery]);
  const speakerLayout = saved?.document.data.metadata.dialogueLayout !== 'prose';
  const title = saved?.document.title ?? block.title;
  const latestBinding = saved?.document.data.messageBindings?.at(-1);
  const hasLatestBinding = useSolarium(state => Boolean(latestBinding && state.workspace.sessions
    .find(session => session.id === context.access.sessionId)?.messages.some(message => message.id === latestBinding && message.content.trim())));
  const activeChapter=context.activeChapter;
  const priorLiveBlock=activeChapter && activeChapter.documentId===locatedDocument && activeChapter.messageId!==context.messageId;
  const historicalLink = !context.documentId && (priorLiveBlock || hasLatestBinding && latestBinding !== context.messageId);
  const canon = saved?.document.data.metadata.canonPoint;
  const storyPoint = canon && canonPointLabel(canon);
  async function edit() {
    try {
      let result = saved;
      if (!result) { const document = await repo.create({ scope: context.access.projectId ? { kind: 'project', id: context.access.projectId } : { kind: 'chat', id: context.access.sessionId! }, title: block.title, markdown: block.content, storyId: context.storyId, messageId: context.messageId, legacyBlockId: block.id }); result = { document, markdown: block.content }; setSaved(result); }
      setEditing(true);
    } catch (e) { setError(String(e)); }
  }
  if (historicalLink) return <div className="chapter-history-link">
    <Button size="small" onClick={() => setReadFull(true)}>Read {title}</Button>
    {readFull && <ChapterReader title={title} text={text} speakerLayout={speakerLayout} spacer={spacer} onClose={() => setReadFull(false)} />}
  </div>;
  return <section id={`inline-writing-${saved?.document.id??context.documentId??block.id}`} className="inline-writing-block" data-scene-spacer={spacer} aria-label={`Writing block: ${block.title}`}>
    <header className="inline-writing-heading chapter-heading"><div className="chapter-heading-name"><Typography component="h2" className="chapter-title">{title}</Typography>
      {storyPoint && <Typography fontSize={10} color="text.secondary">{storyPoint}</Typography>}</div>
      <Stack direction="row" gap={.5} alignItems="center" flexWrap="wrap">
        <Button size="small" onClick={() => setReadFull(true)} disabled={!text.trim()}>Read chapter</Button>
        {block.status === 'streaming' ? <Typography fontSize={11}>Writing</Typography> : <>
          <Button size="small" onClick={() => editing ? setEditing(false) : void edit()}>{editing ? 'Done' : 'Edit'}</Button>
          <details className="chapter-menu"><summary>More</summary><div>
            <Button size="small" onClick={() => downloadBytes(text, 'text/markdown;charset=utf-8', `${title}.md`)}>Export Markdown</Button>
            <Button size="small" onClick={() => exportDocx(text, title)}>Export DOCX</Button>
            {onAdvanced && <Button size="small" onClick={onAdvanced}>Revision history</Button>}
          </div></details>
        </>}
      </Stack>
    </header>
    {(presentation.issues.length>0||block.issues?.length||repeated.length>0)&&<Alert severity="info">{repeated.length?'A passage may repeat an earlier part of this chapter.':'The reading view removed a repeated writing marker.'}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {editing && saved ? <InlineEditor key={saved.document.id} repo={repo} document={saved.document} markdown={text} onSaved={(document, markdown) => { setSaved({ document, markdown }); setRecovery(null); }}/>
      : <div className="inline-writing-prose" tabIndex={0} aria-label="Chapter preview"><ChapterProse text={text} speakerLayout={speakerLayout}/></div>}
    <footer className="chapter-footer"><span>{Array.from(text).length.toLocaleString()} characters · {wordCount(text).toLocaleString()} words</span>
      <span>{block.status === 'streaming' ? 'Saving draft' : saved?.document.data.status === 'final' ? 'Chapter saved' : saved || recovery ? 'Draft saved' : 'Generated draft'}</span></footer>
    {readFull && <ChapterReader title={title} text={text} speakerLayout={speakerLayout} spacer={spacer} onClose={() => setReadFull(false)} />}
  </section>;
}

function InlineEditor({ repo, document, markdown, onSaved }: { repo: WritingRepository; document: WritingDocument; markdown: string; onSaved: (document: WritingDocument, markdown: string) => void }) {
  const current = useRef(document), pending = useRef(markdownContent(markdown));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), queue = useRef(Promise.resolve()), dirty = useRef(false);
  const [status, setStatus] = useState('Saved locally'), [error, setError] = useState('');
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current) return queue.current;
    const content = pending.current; dirty.current = false;
    queue.current = queue.current.then(async () => { try { const saved = await repo.save(current.current, content); current.current = saved; onSaved(saved, content.markdownProjection); setStatus('Saved locally'); } catch (e) { dirty.current = true; setStatus('Unsaved'); setError(String(e)); try { await repo.checkpoint(current.current, content.markdownProjection, 'draft'); } catch (draftError) { setError(`${String(e)} Recovery save also failed: ${String(draftError)}`); } } });
    return queue.current;
  }, [repo, onSaved]);
  const saveRef = useRef(save); useEffect(() => { saveRef.current = save; }, [save]);
  const editor = useEditor({ extensions: writingExtensions, content: markdownContent(markdown).structuredJson, editorProps: { attributes: { class: 'writing-rich-editor inline-writing-editor', role: 'textbox', 'aria-label': 'Edit chapter in chat' } }, onUpdate: ({ editor }) => { pending.current = structuredContent(editor.getJSON()); dirty.current = true; setStatus('Saving…'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void saveRef.current(), 800); }, onBlur: () => { void saveRef.current(); } }, []);
  useEffect(() => () => { void saveRef.current(); }, []);
  return <div>{error && <Alert severity="error">{error} Your current text remains in this editor. <Button onClick={() => void save()}>Retry save</Button></Alert>}<Stack direction="row" gap={.5} px={1}><Button size="small" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</Button><Button size="small" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</Button><Button size="small" onClick={() => editor?.chain().focus().undo().run()}>Undo</Button><Button size="small" onClick={() => void save()}>Save now</Button><Typography fontSize={11} alignSelf="center" role="status">{status}</Typography></Stack><EditorContent editor={editor}/></div>;
}
