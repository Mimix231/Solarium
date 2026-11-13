import type { ReactNode } from 'react';
import { Button } from '@mui/material';

export function SpicaAction({ children, part, type = 'button', disabled, emphasis = false, selected = false, route, submitFlow, onClick }: {
  children: ReactNode; part?: string; type?: 'button' | 'submit'; disabled?: boolean; emphasis?: boolean; selected?: boolean;
  route?: string; submitFlow?: string; onClick?(): void;
}) {
  return <Button type={type} variant={emphasis ? 'contained' : 'outlined'} disabled={disabled} onClick={onClick}
    data-spica-part={part} data-spica-route={route} data-spica-submit={submitFlow} aria-current={selected ? 'true' : undefined}>{children}</Button>;
}
