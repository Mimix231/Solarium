import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { ContentBlock } from '../blocks/protocol';
import type { AccessContext } from '../foundation/types';
import type { WritingDocument } from '../writing/types';
import { WritingRepository, wordCount } from '../writing/repository';
import { markdownContent, structuredContent, writingExtensions } from '../writing/schema';
import { downloadBytes, exportDocx } from '../blocks/exports';
import { readableProse, repeatedPassages } from '../writing/prose';
import { MarkdownBody } from './MarkdownBody';

export interface WritingBlockContext { access: AccessContext; messageId: string; documentId?:string; storyId?: string | null; onContinue?: (title: string) => void }
export function InlineWritingBlock({ block, context, onAdvanced }: { block: ContentBlock; context: WritingBlockContext; onAdvanced?: () => void }) {
  const repo = useMemo(() => new WritingRepository({sessionId:context.access.sessionId,projectId:context.access.projectId}), [context.access.sessionId, context.access.projectId]);
  const [saved, setSaved] = useState<{ document: WritingDocument; markdown: string } | null>(null);
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const doc = (await repo.list()).find(d => context.documentId?d.id===context.documentId:(d.data.originMessageId === context.messageId || d.data.messageBindings?.includes(context.messageId)) && (d.data.legacyBlockId === block.id || !d.data.legacyBlockId && d.title === block.title));
      if (doc) { const result = await repo.get(doc.id); if (!disposed) setSaved({ document: result.document, markdown: result.content.markdownProjection }); }
    };
    void load().catch(e => !disposed && setError(String(e)));
    const timer = block.status !== 'streaming' ? setInterval(() => { if (!editing) void load().catch(e => !disposed && setError(String(e))); }, 2000) : null;
    return () => { disposed = true; if (timer) clearInterval(timer); };
  }, [repo, context.messageId, context.documentId, block.id, block.title, block.status, editing]);
  const original = block.status === 'streaming' ? block.content : saved ? saved.markdown : block.content;
  const presentation=useMemo(()=>readableProse(original),[original]);
  const text=presentation.text;
  const repeated=useMemo(()=>block.status==='streaming'?[]:repeatedPassages(text),[text,block.status]);
  async function recoverFormatting(){if(!saved)return;try{const document=await repo.save(saved.document,markdownContent(text));setSaved({document,markdown:text});}catch(error){setError(String(error));}}
  async function edit() {
    try {
      let result = saved;
      if (!result) { const document = await repo.create({ scope: context.access.projectId ? { kind: 'project', id: context.access.projectId } : { kind: 'chat', id: context.access.sessionId! }, title: block.title, markdown: block.content, storyId: context.storyId, messageId: context.messageId, legacyBlockId: block.id }); result = { document, markdown: block.content }; setSaved(result); }
      setEditing(true);
    } catch (e) { setError(String(e)); }
  }
  return <section id={`inline-writing-${saved?.document.id??context.documentId??block.id}`} className="inline-writing-block" aria-label={`Writing block: ${block.title}`}>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" className="inline-writing-heading"><Typography fontWeight={700} flex={1}>{saved?.document.title ?? block.title}</Typography>{block.status === 'streaming' ? <Typography fontSize={11}>Writing…</Typography> : <><Button size="small" onClick={() => editing ? setEditing(false) : void edit()}>{editing ? 'Read' : 'Edit'}</Button><Button size="small" onClick={() => downloadBytes(text, 'text/markdown;charset=utf-8', `${block.title}.md`)}>Markdown</Button><Button size="small" onClick={() => exportDocx(text, block.title)}>DOCX</Button><Button size="small" onClick={() => context.onContinue?.(block.title)}>Continue</Button><details><summary>More</summary><Button size="small" onClick={onAdvanced}>Revision history & exports</Button></details></>}</Stack>
    {(presentation.issues.length>0||block.issues?.length||repeated.length>0)&&<Alert severity="info">{repeated.length?'A passage may repeat an earlier part of this chapter. The original text is preserved.':'A repeated writing marker was removed from the reading view. Your original revision is preserved.'}{saved&&presentation.issues.length>0&&<Button size="small" onClick={()=>void recoverFormatting()}>Save readable formatting as a new revision</Button>}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {editing && saved ? <InlineEditor key={saved.document.id} repo={repo} document={saved.document} markdown={text} onSaved={(document, markdown) => setSaved({ document, markdown })}/> : <div className="inline-writing-prose"><MarkdownBody text={text}/></div>}
    <Typography fontSize={10} color="text.secondary" px={2} py={1}>{Array.from(text).length.toLocaleString()} characters · {wordCount(text).toLocaleString()} words · {block.status === 'streaming' ? 'Saving draft' : saved ? 'Saved locally' : block.status === 'incomplete' ? 'Incomplete draft' : 'Generated chapter'}</Typography>
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
