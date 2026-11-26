/**
 * Composer execution modes control confirmation frequency, not filesystem scope.
 * All project tools are still validated by the Rust backend and web access
 * remains independently controlled by the composer Web Search toggle.
 */
export type ActionMode = 'ask' | 'auto' | 'yolo';
export type ToolDecision = 'allow' | 'ask' | 'deny';
export type TaskGrant = 'write' | 'check';
import { knowledgeNames, knowledgeWebNames } from './intelligence/knowledge-tools';

import { codingNames, codingWebNames } from './intelligence/coding-tools';
import { spicaResearchNetworkNames } from '../spica/research-tools';
const WEB_TOOLS = new Set(['search_web', 'open_web_page',...spicaResearchNetworkNames,...knowledgeWebNames,...codingWebNames]);
const PROJECT_TOOLS = new Set([
  'list_project_files', 'read_project_file', 'inspect_project', 'search_project_code',
  'replace_project_text', 'apply_project_changes', 'run_project_check',
  'install_project_dependencies',...codingNames.filter(n=>!['recall_context','list_generated_code','read_generated_code'].includes(n)),
]);
const KNOWN_TOOLS = new Set([
  ...WEB_TOOLS, ...PROJECT_TOOLS,...knowledgeNames,'recall_context','list_generated_code','read_generated_code', 'get_current_time', 'calculate', 'search_memories',
]);

export function taskGrantForTool(name: string, args: Record<string, unknown>): TaskGrant | null {
  if (['spica_research_save','create_spica_app', 'edit_spica_graph', 'compose_spica_v2_graph', 'export_spica_app', 'run_spica_graph', 'run_spica_v2_graph',  'migrate_spica_v2_graph', 'history_spica_v2_graph'].includes(name)) return 'write';
  if (name === 'verify_spica_app' || name === 'prepare_spica_app') return 'check';
  if (name === 'create_video_editor_project') return 'write';
  if (name === 'replace_project_text' || name === 'apply_project_changes' || ['save_story_context','save_fiction_profiles','create_writing_document','finalize_writing_document','move_writing_document','create_writing_category','create_story_world','create_story_character','update_character_claims','remember_story_event','remember_character_fact'].includes(name)) return 'write';
  if(['register_project_command','start_project_service','stop_project_service'].includes(name))return 'check';
  if(name==='install_project_dependencies'||name==='run_project_command')return 'check';
  if (name === 'run_project_check' && !['git_status', 'git_diff'].includes(String(args.check ?? ''))) return 'check';
  return null;
}

export function decideToolPermission(input: {
  mode: ActionMode;
  name: string;
  args?: Record<string, unknown>;
  webEnabled: boolean;
  projectAttached: boolean;
  configured?: 'ask' | 'allow' | 'deny';
  taskGrants?: ReadonlySet<TaskGrant>;
}): ToolDecision {
  const { mode, name } = input;
  if (!KNOWN_TOOLS.has(name)) return 'deny';
  if (WEB_TOOLS.has(name) && !input.webEnabled) return 'deny';
  if (PROJECT_TOOLS.has(name) && !input.projectAttached) return 'deny';
  // A user-blocked tool remains blocked in every execution mode.
  if (input.configured === 'deny') return 'deny';
  if (mode === 'ask') return 'ask';
  if (mode === 'yolo') return 'allow';
  const grant = taskGrantForTool(name, input.args ?? {});
  return grant && !input.taskGrants?.has(grant) ? 'ask' : 'allow';
}

/** Compact explanations shared by the composer UI and tests. */
export const ACTION_MODE_HELP: Record<ActionMode, string> = {
  ask: 'Ask before every tool action. Best when working in an unfamiliar project.',
  auto: 'Automatically read and inspect. Approve file edits and build/test commands once per task.',
  yolo: 'Run supported tools without confirmation. May modify files and execute project scripts. Use only in trusted projects.',
};
