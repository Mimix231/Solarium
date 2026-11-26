import { useMemo, useState } from 'react';
import { Button } from '@mui/material';
import type { TerminalRun } from '../domain/types';
import type { VisualAction } from '../engine/visual-actions';
import type { SpicaTaskPlan } from '../engine/intelligence/spica-task-orchestrator';
import type { SparkThoughtToolResult } from '../engine/intelligence/spark-thought';
import { workLogRows, type WorkLogRow } from '../engine/work-log';
import { CommandOutput } from './CommandOutput';
import { downloadBytes } from '../blocks/exports';

function searchJson(output: string | undefined) {
  if (!output) return null;
  try {
    const value = JSON.parse(output) as { kind?: string; searchId?: string; results?: unknown[] };
    return value.kind === 'web_search' && value.searchId && Array.isArray(value.results) ? {
      name: 'search-' + value.searchId + '.json', text: JSON.stringify(value, null, 2) + '\n',
    } : null;
  } catch { return null; }
}

/** Collapse adjacent identical recorded failures visually, without discarding any
 * persisted result. The raw execution history remains independently accessible. */
export function collapseRepeatedWorkResults(results: readonly SparkThoughtToolResult[]):
  Array<{result:SparkThoughtToolResult;count:number}> {
  const grouped: Array<{result:SparkThoughtToolResult;count:number}> = [];
  for (const result of results) {
    const last=grouped.at(-1);
    if(last && result.status==='failed' && last.result.status==='failed' &&
      last.result.name===result.name && last.result.evidence===result.evidence) last.count++;
    else grouped.push({result,count:1});
  }
  return grouped;
}

/** Action-focused SPICA activity, grouped by persisted batches rather than exposing
 * "Thought 37" counters. Every line comes from an actual recorded tool result. */
function ThoughtActivities({plan}:{plan:SpicaTaskPlan}) {
  const history=plan.thoughts??[];
  const batches=plan.batches??[];
  if(!history.length)return null;
  return <div className="spica-work-activities" aria-label="SPICA development activities">
    {batches.slice(-5).map(batch=>{
      const turns=history.filter(thought=>batch.thoughtIndices.includes(thought.index));
      const results=turns.flatMap(thought=>thought.toolResults);
      const recent=collapseRepeatedWorkResults(results.slice(-8));
      const older=collapseRepeatedWorkResults(results.slice(0,-8));
      return <details className="spica-work-activity" key={batch.index} open={batch.status==='active'}>
        <summary><span aria-hidden="true">{batch.status==='checkpointed'?'✓':batch.status==='blocked'?'!':'◌'}</span>
          <strong>{batch.stage==='compose'?'Building application changes':batch.stage==='verify'?'Running build and verification':batch.stage==='discover'?'Finding compatible capabilities':'Reading project state'}</strong>
          <small>{batch.status==='checkpointed'?'Saved':batch.status==='active'?'Working':batch.status}</small>
        </summary>
        <div className="spica-work-activity-detail">
          <p>{batch.objective}</p>
          {older.length>0&&<details className="spica-work-history"><summary>Earlier operations ({results.slice(0,-8).length})</summary>
            <div className="spica-work-tool-list">{older.map(({result,count},i)=><div className="spica-work-tool" key={`${result.id}-${i}`}>
              <span className="spica-work-tool-status" aria-hidden="true">{result.status==='completed'?'✓':'!'}</span>
              <span className="spica-work-tool-label">{result.name} · {result.status}{count>1?` ×${count}`:''}</span>
              <details className="spica-work-tool-result"><summary>Result</summary><pre>{result.evidence}</pre></details>
            </div>)}</div>
          </details>}
          <div className="spica-work-tool-list">{recent.map(({result,count},i)=><div className="spica-work-tool" key={`${result.id}-${i}`}>
            <span className="spica-work-tool-status" aria-hidden="true">{result.status==='completed'?'✓':'!'}</span>
            <span className="spica-work-tool-label" title={result.name}>{result.name} · {result.status}{count>1?` ×${count}`:''}</span>
            <details className="spica-work-tool-result"><summary>Result</summary><pre>{result.evidence}</pre></details>
          </div>)}</div>
          {batch.sourceFiles?.length ? <p>Modified files: {batch.sourceFiles.join(', ')}</p> : null}
          {batch.checkpoint ? <p className="spica-work-checkpoint">Verified checkpoint saved · Graph revision {batch.toRevision??'unchanged'}</p> : null}
          {batch.lastDiagnostic ? <details><summary>Diagnostic</summary><pre>{batch.lastDiagnostic}</pre></details> : null}
        </div>
      </details>;
    })}
  </div>;
}
export function WorkLog({ actions, runs = [], root, busy = false, onOpen, plan }: { actions: VisualAction[]; runs?: TerminalRun[]; root?: string; busy?: boolean; onOpen?: (action: VisualAction) => void; plan?: SpicaTaskPlan | null }) {
  const rows = useMemo(() => workLogRows(actions, runs), [actions, runs]);
  const [expanded, setExpanded] = useState(busy);
  if (!rows.length && !plan?.thoughts?.length) return null;
  const internal = rows.filter(r => r.internal), visible = rows.filter(r => !r.internal);
  const failures = rows.reduce((n, r) => n + (r.status === 'failed' ? Math.max(1, r.attempts.length) : 0), 0);
  const files = new Set(actions.filter(a => a.status === 'completed' && a.kind === 'save').flatMap(a => a.files?.map(f => f.path) ?? []));
  const summary = [plan?.thoughts?.length?'Development activity':'',files.size ? `Saved ${files.size} file${files.size === 1 ? '' : 's'}` : '', runs.length ? `ran ${runs.length} command${runs.length === 1 ? '' : 's'}` : '', !plan?.thoughts?.length && !files.size && !runs.length ? 'Work log' : ''].filter(Boolean).join(', ');
  function row(item: WorkLogRow) {
    if(item.attempts[0]?.title==='Progress update')return <p className="work-log-progress" key={item.id}>{item.attempts[0].detail}</p>;
    const failedAttempt=item.status==='failed'?item.attempts.filter(action=>action.status==='failed').at(-1):undefined;
    const failureReason=(failedAttempt?.detail||failedAttempt?.output||'').replace(/\s+/g,' ').trim();
    return <details className={`work-log-row work-log-${item.status}`} key={item.id}>
      <summary><span aria-hidden="true">{item.status === 'running' ? '◌' : item.status === 'failed' ? '!' : item.status === 'denied' ? '⊘' : '✓'}</span><span>{item.title}</span>{failureReason&&<small className="work-log-failure-reason" title={failureReason}>{failureReason}</small>}{item.attempts.length > 1 && <small>×{item.attempts.length}</small>}<small>{item.status === 'running' ? 'Running' : item.status === 'failed' ? 'Failed' : item.status === 'denied' ? 'Denied' : ''}</small></summary>
      <div className="work-log-detail">{item.run && <CommandOutput run={item.run} root={root}/>} {item.attempts.map(action => {
        const json = action.kind === 'search' && searchJson(action.output);
        return <div key={action.id}><small>{new Date(action.updatedAt).toLocaleTimeString()}</small><p>{action.detail}</p>
          {action.files?.map(file => <div key={file.path}>{file.path}</div>)}
          {action.sources?.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · {source.status}</div>)}
          {action.output && action.output !== action.detail && !item.run && <pre>{action.output}</pre>}
          {json && <Button size="small" onClick={() => downloadBytes(json.text, 'application/json', json.name)}>Download search JSON</Button>}
          <Button size="small" onClick={() => onOpen?.(action)}>Inspect details</Button></div>;
      })}</div>
    </details>;
  }
  return <section className="work-log" aria-label="Reply work log"><button className="work-log-heading" type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}><span aria-hidden="true">⌁</span> {summary}{busy ? ' · Working' : ''}{failures ? ` · ${failures} failed attempt${failures === 1 ? '' : 's'}` : ''}<span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>{(expanded) && <div className="work-log-rows">{plan&&<ThoughtActivities plan={plan}/>}<details className="spica-work-raw" open={!plan?.thoughts?.length}>
    <summary>Tool execution history ({visible.length})</summary><div className="spica-work-actions">{visible.map(row)}</div>
  </details>{internal.length > 0 && <details className="work-log-internal"><summary>Tool selection · {internal.reduce((n, r) => n + r.attempts.length, 0)} operations</summary>{internal.map(row)}</details>}</div>}</section>;
}
