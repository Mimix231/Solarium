import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import type { ComponentProps } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.min.css';
/** Render untrusted LLM text as Markdown, never raw HTML. Remote images are never auto-fetched. */
export function MarkdownBody({ text }: { text: string }) {
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]} components={{
    a: ({ href, children }: ComponentProps<'a'>) => !href || !/^https?:\/\//i.test(href) ? <span>{children}</span> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ src, alt }: ComponentProps<'img'>) => <span className="remote-image-link">[Image: {alt || src || 'external resource'} — external images are not loaded automatically]</span>,
    pre: ({ children }: ComponentProps<'pre'>) => <div className="rich-code-shell"><Tooltip title="Copy code"><IconButton className="copy-code" size="small" aria-label="Copy code" onClick={() => { void navigator.clipboard.writeText(flattenText(children)); }}><ContentCopyRounded sx={{ fontSize: 14 }}/></IconButton></Tooltip><pre>{children}</pre></div>,
  }}>{text}</ReactMarkdown>;
}
function flattenText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (value && typeof value === 'object' && 'props' in value) return flattenText((value as { props: { children?: unknown } }).props.children);
  return '';
}
