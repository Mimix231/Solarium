import { Box, Chip, Stack, Typography } from '@mui/material';

interface ProposedChange { path: string; content: string; expected?: string | null }
const split = (text: string) => text.replace(/\r\n/g, '\n').split('\n');

function changedRange(before: string[], after: string[]) {
  let start = 0;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, before: before.slice(start, oldEnd), after: after.slice(start, newEnd) };
}
/** Preview proposed edits without executing model-supplied content. The Rust backend
 * still checks expected source and scope immediately before each approved write. */
export function ChangesetReview({ args }: { args: Record<string, unknown> }) {
  if (typeof args.path === 'string' && typeof args.expected_fragment === 'string' && typeof args.replacement === 'string') {
    return <Box sx={{ mt: 1, border: '1px solid var(--line)', borderRadius: 2, overflow: 'hidden' }}>
      <Typography fontWeight={700} fontSize={12} p={1} sx={{ bgcolor: 'action.hover' }}>{args.path}</Typography>
      <Box sx={{ p: 1, maxHeight: 330, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 11 }}>
        <Box color="error.main">− {args.expected_fragment}</Box><Box color="success.main">+ {args.replacement}</Box>
      </Box>
    </Box>;
  }
  const changes = Array.isArray(args.files) ? args.files.filter((f): f is ProposedChange =>
    Boolean(f && typeof f === 'object' && typeof f.path === 'string' && typeof f.content === 'string')) : [];
  if (!changes.length) return null;
  return <Stack gap={1.4} sx={{ mt: 1, maxHeight: 440, overflowY: 'auto' }}>
    {changes.map((file, index) => {
      const { start, before, after } = changedRange(file.expected == null ? [] : split(file.expected), split(file.content));
      return <Box key={`${file.path}:${index}`} sx={{ border: '1px solid var(--line)', borderRadius: 2, overflow: 'hidden' }}>
        <Stack direction="row" gap={1} alignItems="center" px={1} py={.7} sx={{ bgcolor: 'action.hover' }}>
          <Typography fontWeight={700} fontSize={12} sx={{ overflowWrap: 'anywhere', flex: 1 }}>{file.path}</Typography>
          <Chip size="small" color={file.expected == null ? 'success' : 'primary'} label={file.expected == null ? 'Create' : 'Modify'}/>
        </Stack>
        <Box sx={{ maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, p: .7 }}>
          {before.slice(0,60).map((line,i) => <Box key={`old${i}`} sx={{ color: 'error.main', bgcolor: 'rgba(255,0,0,.06)' }}>{start + i + 1} − {line}</Box>)}
          {after.slice(0,120).map((line,i) => <Box key={`new${i}`} sx={{ color: 'success.main', bgcolor: 'rgba(0,160,70,.06)' }}>{start + i + 1} + {line}</Box>)}
          {(before.length > 60 || after.length > 120) && <Typography fontSize={10}>Diff shortened for display. The saved change uses the full reviewed file contents.</Typography>}
          {!before.length && !after.length && <Typography fontSize={10} color="text.secondary">No changed lines found.</Typography>}
        </Box>
      </Box>;
    })}
  </Stack>;
}
