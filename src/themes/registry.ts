import { createTheme } from '@mui/material/styles';
import type { ThemeId } from '../domain/types';
export const themes: { id: ThemeId; title: string; description: string; sample: string; dark: boolean; accent: string }[] = [
  { id: 'obsidian', title: 'Obsidian', description: 'Quiet dark precision', sample: 'linear-gradient(130deg,#131826,#292c3d)', dark: true, accent: '#9c92ef' },
  { id: 'crystal', title: 'Crystal', description: 'Luminous frosted glass', sample: 'linear-gradient(130deg,#eefaff,#dcd7f8)', dark: false, accent: '#697fd2' },
  { id: 'aurora', title: 'Aurora', description: 'Neon atmospheric depth', sample: 'linear-gradient(130deg,#142e41,#483779,#1f5b5c)', dark: true, accent: '#83e4d7' },
  { id: 'material', title: 'Material', description: 'Expressive tonal surfaces', sample: 'linear-gradient(130deg,#e7d8fb,#c5d8fd)', dark: false, accent: '#6b55b8' },
  { id: 'slate', title: 'Slate', description: 'Utility-first workstation', sample: 'linear-gradient(130deg,#262b33,#414950)', dark: true, accent: '#a9c0c9' },
  { id: 'peach', title: 'Peach', description: 'Peach blush & orchard mint', sample: 'linear-gradient(130deg,#ffefdf,#f5b5ab)', dark: false, accent: '#c76c70' },
  { id: 'cherry', title: 'Cherry', description: 'Ruby fruit & lacquer', sample: 'radial-gradient(circle at 78% 80%,#ed315d 0 18%,transparent 20%),linear-gradient(130deg,#251022,#8d344e)', dark: true, accent: '#ff7898' },
  { id: 'lime', title: 'Lime', description: 'Cut-glass lime slices', sample: 'linear-gradient(130deg,#eff9d8,#a2dd79)', dark: false, accent: '#36895a' },
  { id: 'blueberry', title: 'Blueberry', description: 'Powdery midnight berries', sample: 'linear-gradient(130deg,#141e46,#725ec5)', dark: true, accent: '#b2a2ff' },
  { id: 'tangerine', title: 'Tangerine', description: 'Sunset rind & orange zest', sample: 'linear-gradient(130deg,#492315,#f29e4e)', dark: true, accent: '#ffb363' },
  { id: 'kiwi', title: 'Kiwi', description: 'Fuzzy rind & green flesh', sample: 'linear-gradient(90deg,#76543c 0 30%,#e8f1ac 31% 65%,#6cab46 66%)', dark: false, accent: '#4c8952' },
  { id: 'strawberry', title: 'Strawberry', description: 'Ruby, ivory & leaf green', sample: 'linear-gradient(100deg,#26583c 0 30%,#fff8f0 31% 65%,#c82643 66%)', dark: false, accent: '#c82643' },
  { id: 'solar', title: 'Solar', description: 'Warm celestial atmosphere', sample: 'linear-gradient(130deg,#101c31,#403020)', dark: true, accent: '#f3bd72' },
];
export function createSolariumTheme(themeId: ThemeId, density: 'ultra' | 'compact' | 'comfortable') {
  const found = themes.find((theme) => theme.id === themeId) ?? themes[0]!;
  const dark = found.dark;
  const compact = density === 'ultra' ? 0.80 : density === 'comfortable' ? 1.2 : 1;
  return createTheme({
    cssVariables: true,
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: found.accent },
      background: { default: themeId === 'strawberry' ? '#fff9f4' : themeId === 'kiwi' ? '#f7f8ea' : dark ? '#111622' : '#f5f6fb', paper: themeId === 'strawberry' ? '#fffdf9' : themeId === 'kiwi' ? '#fffef4' : dark ? '#212636' : '#fff' },
      text: { primary: themeId === 'strawberry' ? '#3b2928' : themeId === 'kiwi' ? '#334629' : dark ? '#ececf6' : '#1d2435', secondary: themeId === 'strawberry' ? '#765b59' : themeId === 'kiwi' ? '#647658' : dark ? '#a6afc2' : '#657186' },
    },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: 13 * compact,
      button: { textTransform: 'none', fontWeight: 600, fontSize: 12 * compact },
      h5: { fontWeight: 750, fontSize: 22 * compact, letterSpacing: '-.6px' },
      h6: { fontWeight: 730, fontSize: 16 * compact },
    },
    shape: { borderRadius: themeId === 'slate' ? 4 : themeId === 'material' ? 22 : 12 },
    components: {
      MuiButton: { defaultProps: { size: 'small', disableElevation: true }, styleOverrides: { root: { minHeight: density === 'ultra' ? 25 : density === 'comfortable' ? 36 : 30, borderRadius: themeId === 'material' ? 100 : 10 } } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiIconButton: { defaultProps: { size: 'small' } },
      MuiTooltip: { defaultProps: { arrow: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiSlider: { styleOverrides: { thumb: { width: 12, height: 12 } } },
    },
  });
}
