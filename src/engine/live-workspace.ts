/** Observable work, never a prediction that the Spark intends to work. */
export type WorkKind = 'search' | 'inspect' | 'generate' | 'edit' | 'writing' | 'execute' | 'check' | 'save';
export type WorkStatus = 'running' | 'completed' | 'failed' | 'denied';
export interface LiveFile { path: string; content: string; complete: boolean; }
export interface LiveWorkspaceUpdate {
  kind: WorkKind;
  status: WorkStatus;
  title: string;
  detail?: string;
  files?: LiveFile[];
  activeFile?: string;
  output?: string;
  url?: string;
  operationId?: string;
  query?: string;
  sources?: { url: string; title: string; excerpt?: string; status: 'found'|'reading'|'read'|'failed' }[];
}

export const workKindForTool = (name: string): WorkKind | null => ({
  search_web: 'search', open_web_page: 'search', inspect_project: 'inspect',
  list_project_files: 'inspect', read_project_file: 'inspect', search_project_code: 'inspect',
  create_video_editor_project:'generate',apply_project_changes: 'generate', replace_project_text: 'edit',
  run_project_check: 'check', run_project_command:'check',list_project_commands:'inspect',read_command_output:'inspect',get_project_map:'inspect',query_project_intelligence:'inspect',read_project_symbol:'inspect',choose_project_tools:'inspect',recall_context:'inspect',complete_project_task:'check',report_project_blocker:'check',
  install_project_dependencies:'check',search_saved_sources:'inspect',search_specific_scene:'search',research_character:'search',
  create_writing_document:'writing',finalize_writing_document:'writing',move_writing_document:'writing',create_writing_category:'writing',read_story_memory:'inspect',remember_story_event:'save',remember_character_fact:'save',
  read_task_brief:'inspect',save_story_context:'save',create_story_world:'writing',create_story_character:'writing',update_character_claims:'writing',suggest_story_consistency_issues:'check',list_writing_categories:'inspect',
} as Record<string, WorkKind>)[name] ?? null;

/**
 * Parse an OPEN JSON string value, such as streamed OpenAI tool arguments.
 * An incomplete escape sequence is held until the next delta arrives. This
 * parser is display-only; never use partial JSON to write a project file.
 */
function partialJsonString(source: string, start: number): { value: string; end: number; complete: boolean } {
  let end = start;
  let escaped = false;
  while (end < source.length) {
    const char = source[end]!;
    if (!escaped && char === '"') break;
    if (!escaped && char === '\\') escaped = true;
    else escaped = false;
    end++;
  }
  const complete = end < source.length;
  const raw = source.slice(start, end);
  if (complete) {
    try { return { value: JSON.parse(`"${raw}"`) as string, end: end + 1, complete }; }
    catch { return { value: '', end: end + 1, complete: false }; }
  }
  // Remove only trailing partial JSON escapes (not arbitrary source text).
  for (let clip = 0; clip <= Math.min(6, raw.length); clip++) {
    try { return { value: JSON.parse(`"${raw.slice(0, raw.length - clip)}"`) as string, end, complete: false }; }
    catch { /* Incomplete Unicode or escaped character; try a shorter tail. */ }
  }
  return { value: '', end, complete: false };
}

/**
 * Renders source as a model streams an apply_project_changes function call.
 * It does not infer that files have been saved; the Rust tool remains the only
 * authority on actual changes. A maximum amount of preview text is kept.
 */
export function streamedProjectFiles(name: string, json: string): LiveFile[] {
  if (!['apply_project_changes', 'replace_project_text'].includes(name)) return [];
  const files: LiveFile[] = [];
  let path = '';
  const field = /"(path|content|replacement)"\s*:\s*"/g;
  let found: RegExpExecArray | null;
  while ((found = field.exec(json))) {
    const result = partialJsonString(json, field.lastIndex);
    if (found[1] === 'path') path = result.complete ? result.value.slice(0, 1024) : '';
    else if (path && (found[1] === 'content' || found[1] === 'replacement')) {
      files.push({ path, content: result.value.slice(0, 250_000), complete: result.complete });
    }
    field.lastIndex = result.end;
    if (!result.complete) break;
    if (files.length >= 12) break;
  }
  return files;
}

export function workTitle(kind: WorkKind, subject: string): string {
  const label: Record<WorkKind, string> = { search: 'Searching', inspect: 'Inspecting', generate: 'Generating',
    edit: 'Editing', writing: 'Writing', execute: 'Executing', check: 'Checking', save: 'Saving' };
  return `${label[kind]}${subject ? ` · ${subject}` : ''}`;
}
