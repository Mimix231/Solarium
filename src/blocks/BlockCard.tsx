import { useLayoutEffect,useRef,useMemo, useState,type ReactNode } from 'react';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import LaunchRounded from '@mui/icons-material/LaunchRounded';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import cpp from 'highlight.js/lib/languages/cpp';
import type { ContentBlock } from './protocol';
import { parseChart, parseDataTable, toCSV } from './data';
import { parseWorkflow } from './workflow';
import { exportBlock, exportedText } from './exports';
import { MarkdownBody } from '../components/MarkdownBody';
import { LivePreview } from './LivePreview';
import {codeWindow,CODE_LINE_HEIGHT} from './code-window';

const grammars = { javascript, typescript, python, rust, css, xml, json, bash, sql, cpp };
for (const [name, grammar] of Object.entries(grammars)) hljs.registerLanguage(name, grammar);
const langAliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust', html: 'xml', svg: 'xml', sh: 'bash', shell: 'bash', c: 'cpp', h: 'cpp', cxx: 'cpp', 'c++': 'cpp' };

function CodeLines({ content, language }: { content: string; language: string }) {
  const [scrollTop,setScrollTop]=useState(0),[height,setHeight]=useState(410);
  const scroller=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(!scroller.current)return;const observer=new ResizeObserver(entries=>{if(entries[0])setHeight(entries[0].contentRect.height);});observer.observe(scroller.current);return()=>observer.disconnect();},[]);
  const lines=useMemo(()=>content.split('\n'),[content]);
  const window=useMemo(()=>codeWindow(lines,scrollTop,height),[lines,scrollTop,height]);
  const rendered = useMemo(() => {
    const lang = langAliases[language.toLowerCase()] ?? language.toLowerCase();
    return window.rows.map((line) => {
      if (!line) return '&nbsp;';
      try { return hljs.getLanguage(lang) ? hljs.highlight(line, { language: lang, ignoreIllegals: true }).value : hljs.highlightAuto(line).value; }
      catch { return line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
    });
  }, [window.rows, language]);
  return <div ref={scroller} className="block-code-lines" role="region" tabIndex={0} aria-label={`${language} source code, ${lines.length} lines`} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)} style={{height:Math.min(410,lines.length*CODE_LINE_HEIGHT+18),maxHeight:410,boxSizing:'border-box'}}><div style={{height:window.top}} aria-hidden="true"/>{rendered.map((line, index) => <div className="block-code-line" key={window.start+index} style={{height:CODE_LINE_HEIGHT,minHeight:CODE_LINE_HEIGHT,lineHeight:`${CODE_LINE_HEIGHT}px`}}><span className="block-line-number" aria-hidden="true">{window.start+index + 1}</span><span className="block-code-value hljs" dangerouslySetInnerHTML={{ __html: line }}/></div>)}<div style={{height:window.bottom}} aria-hidden="true"/></div>;
}
export function ContentBlockBody({ block }: { block: ContentBlock }) {
  if (block.kind === 'writing') return <div className="block-document"><MarkdownBody text={block.content} /></div>;
  if (block.kind === 'code') return <CodeLines content={block.content} language={block.language} />;
  if (block.kind === 'workflow') return <WorkflowView content={block.content}/>;
  if (block.kind === 'equation') return <div className="block-equation"><MarkdownBody text={`$$\n${block.content}\n$$`} /></div>;
  if (block.kind === 'table') return <DataTableView content={block.content}/>;
  if (block.kind === 'chart') return <ChartView content={block.content}/>;
  if (block.kind === 'preview') return <LivePreview content={block.content} finished={block.status === 'complete'}/>;
  if (block.kind === 'image') return <ImageView content={block.content}/>;
  if (block.kind === 'research') return <ResearchView content={block.content}/>;
  return <Box sx={{ p: 1 }}><Chip size="small" color="warning" label={block.provenance === 'tool' ? 'Actual tool result' : block.kind === 'terminal' ? 'Model-suggested output · NOT EXECUTED' : 'Proposed file · NOT SAVED'} sx={{ mb: 1 }} /><pre className="block-raw">{block.content}</pre></Box>;
}
function WorkflowView({ content }: {content:string}) {
  const flow = useMemo(() => parseWorkflow(content), [content]);
  if (!flow) return <pre className="block-raw">{content}</pre>;
  const names = new Map(flow.nodes.map(node => [node.id, node.label]));
  return <div className={`visual-workflow visual-workflow-${flow.direction}`} role="img" aria-label={`Workflow with ${flow.nodes.length} nodes and ${flow.edges.length} connections`}>
    {flow.edges.map((edge,index) => <div key={`${edge.from}-${edge.to}-${index}`} className="visual-workflow-step"><span className="visual-workflow-node">{names.get(edge.from)}</span><span className="visual-workflow-arrow">→</span><span className="visual-workflow-node">{names.get(edge.to)}</span></div>)}
  </div>;
}
function DataTableView({ content }: { content: string }) {
  const table = useMemo(() => parseDataTable(content), [content]);
  const [sort, setSort] = useState<{ column: number; desc: boolean } | null>(null);
  if (!table) return <pre className="block-raw">{content || 'Waiting for rows…'}</pre>;
  const rows = [...table.rows];
  if (sort) rows.sort((a, b) => String(a[sort.column] ?? '').localeCompare(String(b[sort.column] ?? ''), undefined, { numeric: true }) * (sort.desc ? -1 : 1));
  return <div className="block-table-scroll"><table className="block-table"><thead><tr>{table.columns.map((column, i) => <th key={i}><button onClick={() => setSort((s) => ({ column: i, desc: s?.column === i && !s.desc }))} title="Sort by column">{column} {sort?.column === i ? (sort.desc ? '↓' : '↑') : '↕'}</button></th>)}</tr></thead><tbody>{rows.slice(0, 500).map((row, ri) => <tr key={ri}>{table.columns.map((_, i) => <td key={i}>{String(row[i] ?? '')}</td>)}</tr>)}</tbody></table>{rows.length > 500 && <Typography fontSize={10} p={1}>Showing 500 of {rows.length} rows.</Typography>}</div>;
}
function ChartView({ content }: { content: string }) {
  const chart = useMemo(() => parseChart(content), [content]);
  if (!chart) return <pre className="block-raw">{content || 'Waiting for chart data…'}</pre>;
  const { data } = chart;
  const max = Math.max(...data.map((entry) => Math.abs(entry.value)), 1);
  if (chart.type === 'pie') {
    const positive = data.filter((v) => v.value > 0); const total = positive.reduce((sum, entry) => sum + entry.value, 0);
    let used = 0;
    const stops = positive.map((entry, i) => { const start = used / total * 360; used += entry.value; return `hsl(${(i * 79 + 185) % 360} 62% 58%) ${start}deg ${used / total * 360}deg`; });
    return <Stack gap={1} alignItems="center" p={2}><div className="block-pie" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')} style={{ background: total ? `conic-gradient(${stops.join(',')})` : 'var(--line)' }} />{positive.map((item, index) => <Typography key={index} fontSize={11}>{item.label}: {item.value}</Typography>)}</Stack>;
  }
  const points = data.map((item, i) => ({ x: 25 + (data.length === 1 ? 0.5 : i / (data.length - 1)) * 350, y: 175 - item.value / max * 130 }));
  if (chart.type === 'line' || chart.type === 'area') return <svg viewBox="0 0 405 215" className="block-chart-svg" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}><line x1="25" y1="175" x2="385" y2="175" stroke="currentColor" opacity=".25"/>{chart.type === 'area' && <polygon points={`25,175 ${points.map((p) => `${p.x},${p.y}`).join(' ')} 375,175`} fill="var(--accent)" opacity=".22"/>}<polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" />{points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="4" fill="var(--accent)"><title>{`${data[i]!.label}: ${data[i]!.value}`}</title></circle><text x={p.x} y="197" fill="currentColor" fontSize="9" textAnchor="middle">{data[i]!.label.slice(0, 9)}</text></g>)}</svg>;
  return <div className="block-bar-chart" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>{data.slice(0, 40).map((entry, i) => <div className="block-bar-row" key={i}><span title={entry.label}>{entry.label}</span><div><div style={{ width: `${Math.min(100, Math.abs(entry.value) / max * 100)}%` }} /></div><small>{entry.value}</small></div>)}</div>;
}
function ResearchView({ content }: { content: string }) {
  let sources: Array<{ title: string; url: string; excerpt?: string }> = [];
  try { const x: unknown = JSON.parse(content); if (Array.isArray(x)) sources = x.filter((v) => v && typeof v.title === 'string' && typeof v.url === 'string').slice(0, 25); }
  catch { /* Fall back to text. */ }
  return sources.length ? <Stack p={1} gap={.5}>{sources.map((s, i) => /^https:\/\//.test(s.url) ? <Box key={i} className="block-research-item"><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} <LaunchRounded sx={{ fontSize: 11 }}/></a>{s.excerpt && <Typography color="text.secondary" fontSize={10}>{s.excerpt.slice(0, 600)}</Typography>}</Box> : null)}</Stack> : <pre className="block-raw">{content}</pre>;
}
function ImageView({ content }: { content: string }) {
  const source = content.trim();
  return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source) && source.length < 3_000_000 ? <img className="block-image" src={source} alt="Embedded image block" /> : <Box p={1}><Typography fontSize={11}>Remote images are not loaded automatically. Only embedded PNG/JPEG/WebP images are displayed.</Typography>{/^https:\/\//i.test(source) && <a href={source} target="_blank" rel="noopener noreferrer">Open source image</a>}</Box>;
}
export interface BlockCardProps {
  block: ContentBlock;
  onOpen?: (block: ContentBlock) => void;
  onSaveAsset?: (block: ContentBlock) => void;
  expanded?: boolean;
  toolbar?:ReactNode;
}
export function BlockCard({ block, onOpen, onSaveAsset, expanded,toolbar }: BlockCardProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewable = block.kind === 'code' && ['html', 'htm', 'css', 'js', 'javascript'].includes(block.language.toLowerCase());
  async function copy() { try { await navigator.clipboard.writeText(exportedText(block)); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { setCopied(false); } }
  return <section className={`solarium-block kind-${block.kind} ${expanded ? 'expanded' : ''}`} aria-label={`${block.kind} block: ${block.title}`}>
    <Stack direction="row" alignItems="center" gap={.7} px={1.2} py={.65} className="block-titlebar">
      <span aria-hidden="true" className="block-kind-mark">{({ writing: '✎', code: '⌘', table: '▦', chart: '▥', research: '⌕', image: '▧', equation: '∑', terminal: '>_', file: '▤', preview: '◈' } as Record<string, string>)[block.kind]}</span>
      <Typography fontSize={11} fontWeight={750} noWrap title={block.title} sx={{ minWidth: 0 }}>{block.title}</Typography>
      {block.status === 'streaming' && <Chip size="small" label="Streaming…" className="block-streaming" />}
      {block.status === 'incomplete' && <Chip size="small" color="warning" label="Incomplete output" />}
      {block.kind === 'code' && <Chip variant="outlined" size="small" label={block.language}/>}<Box flex={1}/>
      {toolbar}
      {previewable && <Button size="small" sx={{ minWidth: 48, fontSize: 10 }} onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Code' : 'Preview'}</Button>}
      <Tooltip title={copied ? 'Copied' : 'Copy content'}><IconButton size="small" aria-label="Copy block" onClick={() => void copy()}><ContentCopyRounded sx={{ fontSize: 14 }}/></IconButton></Tooltip>
      <Tooltip title="Export file"><IconButton size="small" aria-label="Export block" onClick={() => exportBlock(block)}><DownloadRounded sx={{ fontSize: 14 }}/></IconButton></Tooltip>
      {onSaveAsset && <Tooltip title={block.kind==='writing'?'Save to Writing Library':'Save to Solarium asset library'}><IconButton size="small" aria-label={block.kind==='writing'?'Save to Writing Library':'Save block as asset'} onClick={() => onSaveAsset(block)} disabled={block.status === 'streaming'}><SaveOutlined sx={{ fontSize: 14 }}/></IconButton></Tooltip>}
      {onOpen && <Tooltip title="Open editor workspace"><IconButton size="small" aria-label="Expand block" onClick={() => onOpen(block)}><OpenInFullRounded sx={{ fontSize: 14 }}/></IconButton></Tooltip>}
    </Stack>
    <div className="block-body">{showPreview && previewable ? <LivePreview content={block.content} finished={block.status === 'complete'}/> : <ContentBlockBody block={block}/>}</div>
    <Stack direction="row" justifyContent="space-between" px={1.2} py={.4} className="block-footer"><Typography fontSize={9} color="text.secondary">{block.kind === 'writing' ? `${block.content.trim().split(/\s+/).filter(Boolean).length} words` : block.kind === 'code' ? `${block.content.split('\n').length} lines` : block.kind}</Typography><Typography fontSize={9} color="text.secondary">{block.provenance === 'model' ? 'Generated content' : 'Verified tool result'}</Typography></Stack>
  </section>;
}
export function copyTableCSV(content: string): string { const table = parseDataTable(content); return table ? toCSV(table) : content; }
