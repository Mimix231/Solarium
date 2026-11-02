import { useMemo, useState } from 'react';
import { Button } from '@mui/material';
import type { TerminalRun } from '../domain/types';
import type { VisualAction } from '../engine/visual-actions';
import { workLogRows, type WorkLogRow } from '../engine/work-log';
import { CommandOutput } from './CommandOutput';

export function WorkLog({ actions, runs = [], root, busy = false, onOpen }: { actions: VisualAction[]; runs?: TerminalRun[]; root?: string; busy?: boolean; onOpen?: (action: VisualAction) => void }) {
  const rows = useMemo(() => workLogRows(actions, runs), [actions, runs]);
  const [expanded, setExpanded] = useState(busy);
  if (!rows.length) return null;
  const internal = rows.filter(r => r.internal), visible = rows.filter(r => !r.internal);
  const failures = rows.reduce((n, r) => n + (r.status === 'failed' ? Math.max(1, r.attempts.length) : 0), 0);
  const files = new Set(actions.filter(a => a.status === 'completed' && a.kind === 'save').flatMap(a => a.files?.map(f => f.path) ?? []));
  const summary = [files.size ? `Saved ${files.size} file${files.size === 1 ? '' : 's'}` : '', runs.length ? `ran ${runs.length} command${runs.length === 1 ? '' : 's'}` : '', !files.size && !runs.length ? 'Work log' : ''].filter(Boolean).join(', ');
  function row(item: WorkLogRow) {
    if(item.attempts[0]?.title==='Progress update')return <p className="work-log-progress" key={item.id}>{item.attempts[0].detail}</p>;
    return <details className={`work-log-row work-log-${item.status}`} key={item.id}>
      <summary><span aria-hidden="true">{item.status === 'running' ? '◌' : item.status === 'failed' ? '!' : item.status === 'denied' ? '⊘' : '✓'}</span><span>{item.title}</span>{item.attempts.length > 1 && <small>×{item.attempts.length}</small>}<small>{item.status === 'running' ? 'Running' : item.status === 'failed' ? 'Failed' : item.status === 'denied' ? 'Denied' : ''}</small></summary>
      <div className="work-log-detail">{item.run && <CommandOutput run={item.run} root={root}/>} {item.attempts.map(action => <div key={action.id}><small>{new Date(action.updatedAt).toLocaleTimeString()}</small><p>{action.detail}</p>{action.files?.map(file => <div key={file.path}>{file.path}</div>)}{action.sources?.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · {source.status}</div>)}{action.output && !item.run && <pre>{action.output}</pre>}<Button size="small" onClick={() => onOpen?.(action)}>Inspect details</Button></div>)}</div>
    </details>;
  }
  return <section className="work-log" aria-label="Reply work log"><button className="work-log-heading" type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}><span aria-hidden="true">⌁</span> {summary}{busy ? ' · Working' : ''}{failures ? ` · ${failures} failed attempt${failures === 1 ? '' : 's'}` : ''}<span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>{(expanded) && <div className="work-log-rows">{visible.map(row)}{internal.length > 0 && <details className="work-log-internal"><summary>Tool selection · {internal.reduce((n, r) => n + r.attempts.length, 0)} operations</summary>{internal.map(row)}</details>}</div>}</section>;
}
