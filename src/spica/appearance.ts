import type { Graph } from './graph';

export const styleStates = ['base', 'hover', 'selected', 'focus'] as const;
export const STANDALONE_STYLE_SCOPE = 'standalone';
export type StyleState = typeof styleStates[number];
export type StyleValue = string | number;

type Property = { label: string; fallback: StyleValue } & (
  { type: 'color' } | { type: 'number'; min: number; max: number } | { type: 'choice'; choices: readonly string[] }
);
const color = (label: string, fallback: string): Property => ({ type: 'color', label, fallback });
const number = (label: string, fallback: number, min: number, max: number): Property => ({ type: 'number', label, fallback, min, max });
const choice = (label: string, ...choices: string[]): Property => ({ type: 'choice', label, fallback: choices[0]!, choices });
export const styleProperties = {
  scheme: choice('Color scheme', 'system', 'light', 'dark'),
  background: color('Background', '#fcfcff'), panel: color('Panel background', '#eeeffb'), text: color('Text color', '#22233b'),
  muted: color('Secondary text', '#565978'), accent: color('Accent', '#5345b7'),
  border: color('Border color', '#d4d6ea'), focusRing: color('Focus ring', '#5345b7'),
  font: choice('Typeface', 'system', 'sans', 'serif', 'mono'),
  fontSize: number('Text size (px)', 14, 10, 48),
  fontWeight: choice('Text weight', 'normal', 'medium', 'bold'),
  radius: number('Corner radius (px)', 8, 0, 64),
  spacing: number('App spacing (px)', 8, 2, 28),
  padding: number('Padding (px)', 10, 0, 48),
  gap: number('Gap (px)', 8, 0, 40),
  sidebarWidth: number('Sidebar width (px)', 240, 132, 360),
  layout: choice('Page layout', 'responsive', 'stacked'),
  direction: choice('Group direction', 'row', 'column'),
  align: choice('Text alignment', 'start', 'center', 'end'),
} satisfies Record<string, Property>;
export type StyleProperty = keyof typeof styleProperties;
type Values = Partial<Record<StyleProperty, StyleValue>>;
export interface Appearance {
  theme?: Values;
  blocks?: Record<string, Partial<Record<StyleState, Values>>>;
}
export interface StyleEdit { op: 'set_style'; target: string; state?: StyleState; property: StyleProperty; value: StyleValue | null }
export interface StyleTarget { id: string; label: string; kind: keyof typeof blockProperties; selectable?: boolean }
export interface StyleChange { target: string; label: string; state: StyleState; property: StyleProperty; before: StyleValue | null; after: StyleValue | null }
export interface PreviewStyle { target: string; state: StyleState; inspect: boolean }

const typeStyles = ['text', 'font', 'fontSize', 'fontWeight', 'align'] as const;
const boxStyles = ['background', 'border', 'radius', 'padding', ...typeStyles] as const;
const blockProperties = {
  theme: ['scheme', 'background', 'panel', 'text', 'muted', 'accent', 'border', 'font', 'fontSize', 'radius', 'spacing', 'layout', 'sidebarWidth'],
  panel: [...boxStyles, 'gap'], area: boxStyles, group: [...boxStyles, 'gap', 'direction'],
  text: ['background', 'padding', 'radius', ...typeStyles], field: [...boxStyles, 'gap'],
  button: boxStyles, input: boxStyles, toggle: ['accent'],
} as const satisfies Record<string, readonly StyleProperty[]>;
const target = (id: string, label: string, kind: StyleTarget['kind'], selectable = false): StyleTarget => ({ id, label, kind, selectable });
const collectionTargets = [
  target('record-sidebar', 'Record sidebar', 'panel'), target('record-sidebar-heading', 'Record list heading', 'text'),
  target('record-new', 'New record button', 'button'), target('record-search', 'Search field', 'input'),
  target('record-search-label', 'Search label', 'field'), target('record-archived', 'Show archived checkbox', 'toggle', true),
  target('record-archived-label', 'Show archived label', 'field'), target('record-filter', 'List filter', 'input'),
  target('record-filter-label', 'Filter label', 'field'), target('record-row', 'Record list item', 'button', true),
  target('record-empty', 'Empty list message', 'text'), target('record-pagination', 'Pagination', 'group'),
  target('record-previous', 'Previous page button', 'button'), target('record-next', 'Next page button', 'button'),
  target('record-editor', 'Record editor', 'panel'), target('record-editor-heading', 'Record editor heading', 'text'),
  target('record-fields', 'Record fields', 'field'), target('record-actions', 'Record actions', 'group'),
  target('record-save', 'Save record button', 'button'), target('record-archive', 'Archive or restore button', 'button'),
  target('record-status', 'Record status', 'text'), target('record-error', 'Record error', 'text'),
];
const settingsTargets = [
  target('settings-sidebar', 'Settings sidebar', 'panel'), target('settings-name', 'App name', 'text'),
  target('settings-page', 'Settings page', 'area'), target('settings-heading', 'Settings heading', 'text'),
  target('settings-fields', 'Settings fields', 'field'), target('settings-empty', 'Empty settings message', 'text'),
  target('settings-actions', 'Settings actions', 'group'), target('settings-save', 'Save preferences button', 'button'),
  target('settings-export', 'Export JSON button', 'button'), target('settings-import', 'Import JSON button', 'button'),
  target('settings-status', 'Settings status', 'text'), target('settings-error', 'Settings error', 'text'),
];
type Design = Pick<Graph, 'collection' | 'collections' | 'pages' | 'controls' | 'program'>;
export function styleTargets({ collection, collections, pages, controls, program }: Design): StyleTarget[] {
  const settings = (!collection && !program?.screens.length) || controls.length > 0;
  const fields = [...new Map([...(collections ?? []).flatMap(item => item.fields), ...(collection?.fields ?? [])].map(field => [field.key, field])).values()];
  const hasFilter = fields.some(field => field.type === 'boolean' && field.filter);
  return [
    target('app', 'App theme', 'theme'), target('app-footer', 'App footer', 'text'),
    ...(collection ? [
      ...collectionTargets.filter(part => hasFilter || !part.id.startsWith('record-filter')),
      ...fields.flatMap(field => [
        target('record-field-' + field.key, field.label + ' field', 'field'),
        target('record-input-' + field.key, field.label + ' control', field.type === 'boolean' ? 'toggle' : 'input', field.type === 'boolean'),
      ]),
    ] : []),
    ...(program?.screens.length ? [target('screen-nav', 'Screen navigation', 'group'), ...program.screens.flatMap(screen => [
      target('screen-' + screen.id, screen.label + ' screen', 'area'), target('route-' + screen.id, screen.label + ' tab', 'button', true),
      ...(screen.intro || screen.buttons?.length ? [target('intro-' + screen.id, screen.label + ' introduction', 'group')] : []),
      ...(screen.buttons ?? []).map(button => target(`button-${screen.id}-${button.id}`, button.label + ' button', 'button')),
    ])] : []),
    ...(program?.screens.some(screen => screen.view === 'review') ? [target('record-transfer', 'Record transfer and review', 'panel')] : []),
    ...(program?.screens.some(screen => screen.view === 'review' && screen.mapping) ? [target('csv-column-map', 'CSV column mapping', 'panel')] : []),
    ...(program?.screens.some(screen => screen.view === 'table') ? [target('record-table', 'Record table', 'panel'), target('record-badge', 'Record status badge', 'text')] : []),
    ...(program?.screens.some(screen => screen.view === 'game') ? [target('game-viewport', 'Playable 2D scene', 'panel')] : []),
    ...(collection && settings ? [target('record-settings', 'Settings section', 'area'), target('record-settings-summary', 'Settings expander', 'button')] : []),
    ...(settings ? [
      ...settingsTargets,
      ...pages.map(page => target('settings-tab-' + page.id, page.label + ' tab', 'button', true)),
      ...controls.flatMap(control => [
        target('setting-field-' + control.id, control.label + ' field', 'field'),
        target('setting-input-' + control.id, control.label + ' control', control.widget === 'toggle' ? 'toggle' : 'input', control.widget === 'toggle'),
      ]),
    ] : []),
  ];
}

export function supportedStates(part: StyleTarget): readonly StyleState[] {
  return ['button', 'input', 'toggle'].includes(part.kind)
    ? styleStates.filter(state => state !== 'selected' || part.selectable) : ['base'];
}

export function supportedProperties(part: StyleTarget, state: StyleState): readonly StyleProperty[] {
  if (state === 'base') return blockProperties[part.kind];
  const properties: StyleProperty[] = part.kind === 'toggle' ? ['accent'] : ['background', 'text', 'border', 'radius'];
  if (state === 'focus') properties.push('focusRing');
  return properties;
}

export function styleTokenOptions(property: StyleProperty): string[] {
  const type = styleProperties[property].type;
  return Object.keys(themeCss).filter(key =>
    styleProperties[key as StyleProperty].type === type && (type !== 'choice' || key === property)).map(key => '$' + key);
}

export function normalizeStyleValue(property: StyleProperty, value: unknown, allowToken = false): StyleValue {
  const spec = styleProperties[property];
  if (allowToken && typeof value === 'string' && value.startsWith('$') && styleTokenOptions(property).includes(value)) return value;
  if (spec.type === 'color' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (spec.type === 'number' && typeof value === 'number' && Number.isInteger(value) && value >= spec.min && value <= spec.max) return value;
  if (spec.type === 'choice' && typeof value === 'string' && spec.choices.includes(value)) return value;
  const expected = spec.type === 'color' ? 'a six-digit hex color such as #ffbf47' :
    spec.type === 'number' ? `an integer from ${spec.min} to ${spec.max}` : spec.choices.join(', ');
  throw Error(`Style property ${property} needs ${expected}.`);
}

function requirePart(parts: Map<string, StyleTarget>, id: string, state: StyleState) {
  const part = parts.get(id);
  if (!part) throw Error(`Unknown appearance target "${id}". Use an ID from the graph's style catalogue.`);
  if (!supportedStates(part).includes(state)) throw Error(`${part.label} has no ${state} style. Use ${supportedStates(part).join(', ')}.`);
  return part;
}

function requireProperty(part: StyleTarget, state: StyleState, property: StyleProperty) {
  const allowed = supportedProperties(part, state);
  if (!allowed.includes(property)) throw Error(`Style property ${property} is unavailable for ${part.label} in ${state}. Use ${allowed.join(', ')}.`);
}

const styleObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Appearance styles must be objects.');
  return value as Record<string, unknown>;
};

export function validateAppearance(design: Design, value: unknown) {
  const appearance = styleObject(value);
  if (Object.keys(appearance).some(key => key !== 'theme' && key !== 'blocks')) throw Error('Unknown appearance section.');
  const parts = new Map(styleTargets(design).map(part => [part.id, part]));
  const validateValues = (id: string, state: StyleState, values: unknown) => {
    const part = requirePart(parts, id, state);
    for (const [key, value] of Object.entries(styleObject(values))) {
      requireProperty(part, state, key as StyleProperty);
      normalizeStyleValue(key as StyleProperty, value, id !== 'app');
    }
  };
  if (appearance.theme !== undefined) validateValues('app', 'base', appearance.theme);
  if (appearance.blocks !== undefined) for (const [id, states] of Object.entries(styleObject(appearance.blocks))) {
    if (id === 'app' || !parts.has(id)) throw Error(`Unknown appearance block "${id}".`);
    for (const [state, values] of Object.entries(styleObject(states))) validateValues(id, state as StyleState, values);
  }
}

export function styleValues(appearance: Appearance | undefined, id: string, state: StyleState): Values {
  return (id === 'app' ? appearance?.theme : appearance?.blocks?.[id]?.[state]) ?? {};
}

/** Mutates a private graph copy. The caller commits the validated batch as one revision. */
export function applyStyleEdit(graph: Graph, { target: id, state = 'base', property, value }: StyleEdit) {
  const part = requirePart(new Map(styleTargets(graph).map(part => [part.id, part])), id, state);
  requireProperty(part, state, property);
  const appearance = graph.appearance ?? {};
  const values = { ...styleValues(appearance, id, state) };
  if (value === null) delete values[property];
  else values[property] = normalizeStyleValue(property, value, id !== 'app');
  if (id === 'app') {
    if (Object.keys(values).length) appearance.theme = values;
    else delete appearance.theme;
  } else {
    const blocks = appearance.blocks ?? {};
    const states = { ...blocks[id] };
    if (Object.keys(values).length) states[state] = values;
    else delete states[state];
    if (Object.keys(states).length) blocks[id] = states;
    else delete blocks[id];
    if (Object.keys(blocks).length) appearance.blocks = blocks;
    else delete appearance.blocks;
  }
  if (Object.keys(appearance).length) graph.appearance = appearance;
  else delete graph.appearance;
}

export function styleChanges(before: Graph, after: Graph): StyleChange[] {
  return styleTargets(after).flatMap(part => supportedStates(part).flatMap(state => {
    const oldValues = styleValues(before.appearance, part.id, state);
    const newValues = styleValues(after.appearance, part.id, state);
    return supportedProperties(part, state).flatMap(property => oldValues[property] === newValues[property] ? [] : [{
      target: part.id, label: part.label, state, property, before: oldValues[property] ?? null, after: newValues[property] ?? null,
    }]);
  }));
}

const fonts: Record<string, string> = { system: 'system-ui,sans-serif', sans: 'Arial,sans-serif', serif: 'Georgia,serif', mono: 'Consolas,monospace' };
const weights: Record<string, string> = { normal: '400', medium: '500', bold: '700' };
const themeCss: Partial<Record<StyleProperty, string>> = {
  background: '--surface', panel: '--panel', text: '--ink', muted: '--muted', accent: '--accent', border: '--line',
  font: '--app-font', fontSize: '--app-font-size', radius: '--app-radius', spacing: '--app-space', sidebarWidth: '--sidebar-width',
};
const blockCss: Partial<Record<StyleProperty, string>> = {
  background: 'background-color', text: 'color', border: 'box-shadow', accent: 'accent-color', focusRing: 'outline-color',
  font: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', radius: 'border-radius', padding: 'padding',
  gap: 'gap', direction: 'flex-direction', align: 'text-align',
};

function accentInk(hex: string) {
  const linear = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722 > .179 ? '#000000' : '#ffffff';
}

function declarations(values: Values, theme: boolean) {
  return Object.entries(values).flatMap(([key, input]) => {
    const property = key as StyleProperty;
    const name = (theme ? themeCss : blockCss)[property];
    if (!name) return [];
    const value = normalizeStyleValue(property, input, !theme);
    const resolved = typeof value === 'number' ? value + 'px' : value.startsWith('$') ? `var(${themeCss[value.slice(1) as StyleProperty]})` :
      property === 'font' ? fonts[value] : property === 'fontWeight' ? weights[value] : value;
    const css = property === 'border' && !theme ? `inset 0 0 0 1px ${resolved}` : resolved;
    return [`${name}:${css}`, ...(theme && property === 'accent' ? ['--accent-ink:' + accentInk(String(value))] : [])];
  }).join(';');
}

/** Shared by the live renderer and the emitted app. State forcing is scoped to the sample frame. */
export function appearanceCss(appearance: Appearance | undefined, surfaceId: string, preview?: PreviewStyle): string {
  const scope = `.spica-app[data-spica-surface=${JSON.stringify(surfaceId)}]`;
  const theme = declarations(appearance?.theme ?? {}, true);
  const rules = theme ? [scope + '{' + theme + '}'] : [];
  const previewPart = preview && scope + (preview.target === 'app' ? '' : ` [data-spica-part=${JSON.stringify(preview.target)}]`);
  if (preview?.state === 'focus') rules.push(`${previewPart}{outline:2px solid var(--accent);outline-offset:2px}`);
  const selectors: Record<StyleState, string> = {
    base: '', hover: ':where(:hover:not(:disabled))', selected: ':where([aria-current]:not([aria-current="false"]),:checked)',
    focus: ':where(:focus-visible,.spica-file:focus-within,summary:focus-visible)',
  };
  for (const [id, states] of Object.entries(appearance?.blocks ?? {})) {
    const part = ` [data-spica-part=${JSON.stringify(id)}]`;
    for (const state of styleStates) {
      const css = declarations(states[state] ?? {}, false);
      if (!css) continue;
      const simulated = preview?.target === id && preview.state === state && state !== 'base'
        ? `,${scope}[data-spica-simulate]${part}` : '';
      rules.push(`${scope}${part}${selectors[state]}${simulated}{${css}}`);
    }
  }
  if (preview?.inspect) rules.push(`${previewPart}{outline:2px dashed #48aaa9;outline-offset:-2px}`);
  return rules.join('\n');
}
