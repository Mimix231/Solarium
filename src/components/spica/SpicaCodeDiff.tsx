import { useMemo, useState } from 'react';
import { Alert, Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DiffEditor } from '@monaco-editor/react';
import { ChangesetReview } from '../ChangesetReview';

export interface SpicaSourceChange { path: string; expected?: string | null; content: string }
export interface SpicaSourceConflict { path: string; current: string; proposed: string }

const languageOf = (path: string): string => {
  if (/\.(tsx?|mts|cts)$/i.test(path)) return 'typescript';
  if (/\.(jsx?|mjs|cjs)$/i.test(path)) return 'javascript';
  if (/\.json$/i.test(path)) return 'json';
  if (/\.css$/i.test(path)) return 'css';
  if (/\.(md|markdown)$/i.test(path)) return 'markdown';
  if (/\.(rs)$/i.test(path)) return 'rust';
  if (/\.(toml)$/i.test(path)) return 'ini';
  return 'plaintext';
};
const MAX_MONACO_BYTES = 480_000;

/** Real, revision-scoped source snapshots from inspectExport; never fabricates a file diff
 * from a graph name or LLM narrative. Conflicts display actual disk vs proposed content. */
export function SpicaCodeDiff({ changes, conflicts = [], graphDiff, revision, origin }: {
  changes: readonly SpicaSourceChange[];
  conflicts?: readonly SpicaSourceConflict[];
  graphDiff?: SpicaSourceChange;
  revision: number;
  origin: string;
}) {
  const [selectedPath, setSelectedPath] = useState('');
  const entries = useMemo(() => {
    const collision = new Map(conflicts.map(conflict => [conflict.path, conflict]));
    const result: { path: string; before: string; after: string; conflict: boolean; source: boolean }[] = [];
    for (const change of changes) if (!collision.has(change.path)) result.push({ path: change.path, before: change.expected ?? '', after: change.content,
      conflict: false, source: true });
    for (const conflict of conflicts) result.push({ path: conflict.path, before: conflict.current, after: conflict.proposed,
      conflict: true, source: true });
    if (graphDiff) result.push({ path: graphDiff.path, before: graphDiff.expected ?? '', after: graphDiff.content,
      conflict: false, source: false });
    return result;
  }, [changes, conflicts, graphDiff]);
  const chosen = entries.find(item => item.path === selectedPath) ?? entries.find(item => item.source && /\.(tsx?|rs|css)$/i.test(item.path)) ?? entries[0];
  const tooLarge = Boolean(chosen && chosen.before.length + chosen.after.length > MAX_MONACO_BYTES);
  return <Stack className="spica-diff-panel" gap={1.1}>
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <Typography fontWeight={700} fontSize={13}>Source changes</Typography>
      <Chip size="small" variant="outlined" label={`Graph revision ${revision}`} />
      <Chip size="small" color={conflicts.length ? 'error' : 'default'} variant="outlined"
        label={conflicts.length ? `${conflicts.length} ownership conflicts` : origin} />
    </Stack>
    {!entries.length ? <Alert severity="info">No source differences are pending or recorded for this revision. Build logs and native verification remain available.</Alert> : <>
      <TextField select size="small" fullWidth label="Changed file" value={chosen?.path ?? ''}
        onChange={event => setSelectedPath(event.target.value)}>
        {entries.map(file => <MenuItem key={file.path} value={file.path}>
          {file.conflict ? '⚠ Conflict · ' : file.source ? '' : 'Graph · '}{file.path}
        </MenuItem>)}
      </TextField>
      {chosen?.conflict && <Alert severity="error">This managed file differs from its recorded source. SPICA will not overwrite it automatically.</Alert>}
      {chosen && <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="space-between">
        <Typography fontSize={11} color="error.light">− Current or previous source</Typography>
        <Typography fontSize={11} color="success.light">+ Proposed source</Typography>
      </Stack>}
      {chosen && (tooLarge ? <Box className="spica-diff-oversized">
        <Alert severity="warning">This file exceeds the interactive diff limit. The complete change is retained in the source record; the preview below is abbreviated.</Alert>
        <ChangesetReview args={{ files: [{ path: chosen.path, expected: chosen.before, content: chosen.after }] }} />
      </Box> : <Box className="spica-monaco-diff" aria-label={`Source diff for ${chosen.path}`}>
        <DiffEditor key={`${revision}:${chosen.path}:${chosen.before.length}:${chosen.after.length}`}
          theme="vs-dark" original={chosen.before} modified={chosen.after}
          originalModelPath={`spica-original://${chosen.path}`} modifiedModelPath={`spica-proposed://${chosen.path}`}
          language={languageOf(chosen.path)} loading="Loading source diff…"
          options={{ readOnly: true, originalEditable: false, renderSideBySide: true, automaticLayout: true,
            scrollBeyondLastLine: false, minimap: { enabled: false },
            fontSize: 12, lineNumbers: 'on', diffAlgorithm: 'advanced',
            renderIndicators: true, ignoreTrimWhitespace: false, wordWrap: 'off' }} />
      </Box>)}
    </>}
  </Stack>;
}
