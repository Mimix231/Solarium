import type { TerminalRun } from '../domain/types';
import type { VisualAction } from './visual-actions';
export interface WorkLogRow { id: string; title: string; status: VisualAction['status']; attempts: VisualAction[]; run?: TerminalRun; internal: boolean }
export function workLogRows(actions: readonly VisualAction[], runs: readonly TerminalRun[]): WorkLogRow[] {
  const rows: WorkLogRow[] = []; const usedRuns = new Set<number>();
  for (const action of actions) {
    let result: { command?: string; command_id?: string;characters?:{name:string}[];savedFacts?:number;title?:string;id?:string } = {};
    try { result = JSON.parse(action.output ?? ''); } catch { const prefix=/^\s*\{\s*"command"\s*:\s*("(?:\\.|[^"\\])*")/.exec(action.output??'');if(prefix)try{result={command:JSON.parse(prefix[1]!)};}catch{/* Incomplete command header: keep it unexecuted. */} }
    const command = result.command;
    const runIndex = command ? runs.findIndex((r, i) => !usedRuns.has(i) && r.command === command) : -1;
    if (runIndex >= 0) usedRuns.add(runIndex);
    const internal = /choose_project_tools/.test(action.title);
    const savedCast=action.status==='completed'&&Array.isArray(result.characters)&&typeof result.savedFacts==='number';
    const createdDraft=action.status==='completed'&&/create_writing_document/.test(action.title)&&result.id&&result.title;
    const title = savedCast ? `Saved ${result.characters!.map(c=>c.name).join(', ')} · ${result.savedFacts} facts` : createdDraft ? `Created ${result.title} draft` : command ? `Ran ${command}` : internal ? 'Selected tools' : action.files?.length ? `${action.status === 'completed' ? 'Saved' : 'Preparing'} ${action.files.length} file${action.files.length === 1 ? '' : 's'}` : action.kind === 'inspect' ? `Inspected ${action.title.replace(/^Inspecting\s*[·:]\s*/i, '')}` : action.title;
    const sameCommandRejection=action.status==='failed'&&/UNKNOWN_COMMAND_ID|Command is not declared/.test(action.detail);
    const previous = rows.find(row => row.status === action.status && !command && (sameCommandRejection&&/UNKNOWN_COMMAND_ID|Command is not declared/.test(row.attempts[0]?.detail??'') || row.title === title && row.attempts[0]?.detail === action.detail && row.attempts[0]?.output === action.output));
    if (previous) previous.attempts.push(action);
    else rows.push({ id: action.id, title, status: action.status, attempts: [action], internal, ...(runIndex >= 0 ? { run: runs[runIndex] } : {}) });
  }
  runs.forEach((run, i) => { if (!usedRuns.has(i)) rows.push({ id: `command-${i}`, title: `Ran ${run.command}`, status: run.exitCode === 0 && !run.timedOut && !run.cancelled ? 'completed' : 'failed', attempts: [], run, internal: false }); });
  return rows;
}
