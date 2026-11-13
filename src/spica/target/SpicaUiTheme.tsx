import { useMemo, type ReactNode } from 'react';
import { createTheme, ThemeProvider, useMediaQuery } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import type { Appearance } from '../appearance';

/** A single renderer-independent design-token contract for preview and exported apps.
 * Only validated graph appearance values may change these tokens; generated code is never executed.
 */
export const SPICA_MATERIAL_THEME_VERSION = 1;
const appStyleNonce = typeof document === 'undefined' ? null :
  document.querySelector<HTMLMetaElement>('meta[name="spica-style-nonce"]')?.content || null;
const appStyleCache = appStyleNonce ? createCache({ key: 'spica', nonce: appStyleNonce }) : null;
export function SpicaMaterialProvider({ appearance, scheme = 'system', children }: {
  appearance?: Appearance; scheme?: string; children: ReactNode;
}) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const chosen = appearance?.theme?.scheme ?? scheme;
  const mode = chosen === 'dark' || (chosen !== 'light' && systemDark) ? 'dark' : 'light';
  const tokens = appearance?.theme;
  const theme = useMemo(() => {
    const dark = mode === 'dark';
    const text = typeof tokens?.text === 'string' ? tokens.text : dark ? '#eef2ff' : '#222b42';
    const accent = typeof tokens?.accent === 'string' ? tokens.accent : dark ? '#b4a7ff' : '#6556ca';
    return createTheme({
      palette: {
        mode, primary: { main: accent }, secondary: { main: dark ? '#70dad6' : '#007f82' },
        background: { default: typeof tokens?.background === 'string' ? tokens.background : dark ? '#101b35' : '#f4f6fc',
          paper: typeof tokens?.panel === 'string' ? tokens.panel : dark ? '#1c2744' : '#ffffff' },
        text: { primary: text, secondary: typeof tokens?.muted === 'string' ? tokens.muted : dark ? '#b5c4df' : '#52627e' },
        divider: typeof tokens?.border === 'string' ? tokens.border : dark ? '#526288' : '#d8ddef',
      },
      shape: { borderRadius: typeof tokens?.radius === 'number' ? tokens.radius : 12 },
      typography: { fontFamily: 'Inter, Segoe UI, system-ui, sans-serif', fontSize: Math.max(12, Number(tokens?.fontSize ?? 14)),
        button: { textTransform: 'none', fontWeight: 650 }, h6: { fontWeight: 720 } },
      components: {
        MuiButton: { defaultProps: { size: 'small', disableElevation: true }, styleOverrides: {
          root: { borderRadius: 10, padding: '8px 14px', minHeight: 36 }, contained: { backgroundImage: dark ? 'linear-gradient(115deg,#6654d2,#8771ee)' : undefined },
        } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, background: dark ? '#09132655' : '#ffffffb8' } } },
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiSwitch: { defaultProps: { color: 'primary' } },
        MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
      },
    });
  }, [mode, tokens]);
  const content = <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  return appStyleCache ? <CacheProvider value={appStyleCache}>{content}</CacheProvider> : content;
}
