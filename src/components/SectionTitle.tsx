import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
export function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} mb={3}>
    <Box><Typography className="eyebrow">{eyebrow}</Typography><Typography variant="h5" mt={.4}>{title}</Typography><Typography color="text.secondary" fontSize={12} mt={.6}>{description}</Typography></Box>
    {action}
  </Stack>;
}
