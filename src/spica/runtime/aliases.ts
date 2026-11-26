/** Explicit backwards-friendly names for VERIFIED executable blocks. These are
 * identifier aliases only, never tool names, executors, or new registered blocks.
 * Do not use fuzzy matching to execute arbitrary candidate IDs. */
export const runtimeBlockAliases: Readonly<Record<string, string>> = Object.freeze({
  notes_list:'spica.runtime.record_list',
  notes_db_reader:'spica.runtime.record_read',
  notes_db_writer:'spica.runtime.record_write',
  notes_save:'spica.runtime.record_write_on_event',
  'spica.runtime.save_on_click':'spica.runtime.record_write_on_event',
  notes_db_delete:'spica.runtime.record_delete',
  MarkdownEditorBlock:'spica.runtime.ui_markdown_editor',
  MarkdownRendererBlock:'spica.runtime.ui_markdown',
  NotesListBlock:'spica.runtime.ui_list',
  'spica.runtime.markdown_renderer':'spica.runtime.ui_markdown',
  'spica.runtime.markdown_editor':'spica.runtime.ui_markdown_editor',
  'spica.runtime.rich_text_editor':'spica.runtime.ui_markdown_editor',
  'spica.runtime.notes_list_view':'spica.runtime.ui_list',
  'spica.runtime.notes_list':'spica.runtime.record_list',
  'spica.runtime.notes_db_reader':'spica.runtime.record_read',
  'spica.runtime.notes_db_writer':'spica.runtime.record_write',
  'spica.runtime.note_list':'spica.runtime.record_list',
  'spica.runtime.recent_notes':'spica.runtime.record_list',
  'spica.runtime.list_view':'spica.runtime.ui_list',
  'spica.runtime.text_editor':'spica.runtime.ui_markdown_editor',
  'spica.runtime.search_input':'spica.runtime.ui_search_field',
  'spica.runtime.selectable_notes':'spica.runtime.ui_selectable_list',
  'spica.runtime.page_router':'spica.runtime.ui_screen_router',
  'spica.runtime.state_store':'spica.runtime.state_value',
  'spica.runtime.state_set':'spica.runtime.state_update',
  'spica.runtime.event_handler':'spica.runtime.ui_event_binding',
  'spica.runtime.record_update_timestamps':'spica.runtime.record_timestamps',
  'spica.runtime.refresh_records':'spica.runtime.record_refresh',
  'spica.runtime.toast':'spica.runtime.ui_notification',
});
/** Derived spelling variants are installed only for IDs that actually exist in
 * the executable registry. Ambiguous names never become executable aliases. */
const verifiedVariants = new Map<string,string>();
function pascal(value:string):string {
  return value.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join('');
}
export function installVerifiedRuntimeAliases(ids: readonly string[]): void {
  verifiedVariants.clear();
  const existing = new Set(ids);
  const claims = new Map<string,Set<string>>();
  for(const id of ids){
    const short=id.replace(/^spica\.runtime\./,'');
    const variants=[short,short.replace(/_/g,'-'),pascal(short),`${pascal(short)}Block`,
      ...(short.startsWith('ui_')?[short.slice(3),pascal(short.slice(3)),`${pascal(short.slice(3))}Block`]:[])];
    for(const alias of variants){
      if(alias===id || existing.has(alias))continue;
      const set=claims.get(alias)??new Set<string>();set.add(id);claims.set(alias,set);
    }
  }
  for(const [alias,idsForAlias] of claims){
    if(idsForAlias.size!==1 || Object.hasOwn(runtimeBlockAliases,alias))continue;
    verifiedVariants.set(alias,[...idsForAlias][0]!);
  }
}
/** Canonical IDs always win; guessed semantic aliases are intentionally absent. */
export function canonicalRuntimeBlockId(id: string): string {
  return runtimeBlockAliases[id] ?? verifiedVariants.get(id) ?? id;
}
export function runtimeBlockAliasNames(canonical: string): string[] {
  return [...Object.entries(runtimeBlockAliases).filter(([,target])=>target===canonical).map(([alias])=>alias),
    ...[...verifiedVariants].filter(([,target])=>target===canonical).map(([alias])=>alias)];
}
