import { useEffect, useId, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@mui/material';
import { validPreferenceValue, type AppPlan, type Value } from '../graph';
import { appearanceCss, type Appearance, type PreviewStyle } from '../appearance';
import { SpicaMaterialProvider } from './SpicaUiTheme';
import { SpicaAction, SpicaTextInput, SpicaOptionSelect, SpicaToggle } from './ui/SpicaControls';

export type Preferences = Record<string, Value>;
export interface PreferenceStorage {
  load(): Promise<unknown>;
  save(values: Preferences): Promise<void>;
}

export function normalizePreferences(plan: AppPlan, input: unknown, strict = false): Preferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Preferences must be a JSON object.');
  const incoming = input as Record<string, unknown>;
  const definitions = plan.pages.flatMap(page => page.controls.map(control => control.definition));
  const allowed = new Set(definitions.map(definition => definition.key));
  if (strict && Object.keys(incoming).some(key => !allowed.has(key))) throw Error('This file contains unknown preferences.');
  return Object.fromEntries(definitions.map(definition => {
    const value = incoming[definition.key];
    if (validPreferenceValue(definition, value)) return [definition.key, value];
    if (Object.hasOwn(incoming, definition.key)) throw Error('Invalid value for ' + definition.key);
    return [definition.key, definition.initial];
  }));
}

export function SpicaSurface({ appearance, theme = 'system', preview, stylesheetScope, children }: {
  appearance?: Appearance; theme?: string; preview?: PreviewStyle; stylesheetScope?: string; children: ReactNode;
}) {
  const localId = useId();
  const id = stylesheetScope ?? localId;
  const css = stylesheetScope ? '' : appearanceCss(appearance, id, preview);
  const scheme = appearance?.theme?.scheme;
  const darkSystem = useMediaQuery('(prefers-color-scheme: dark)');
  const requestedScheme = scheme && scheme !== 'system' ? scheme : theme;
  const renderedScheme = requestedScheme === 'dark' || requestedScheme === 'light' ? requestedScheme : darkSystem ? 'dark' : 'light';
  return <SpicaMaterialProvider appearance={appearance} scheme={renderedScheme}><div className="spica-frame">
    <div className="spica-app" data-theme={renderedScheme} data-spica-surface={id}
      data-spica-part="app" data-spica-layout={appearance?.theme?.layout} data-spica-simulate={preview?.state !== 'base' && preview ? '' : undefined}>
      {css && <style>{css}</style>}{children}
    </div>
  </div></SpicaMaterialProvider>;
}

export function SettingsApp({ plan, storage, footer, appearance, preview, stylesheetScope }: {
  plan: AppPlan; storage: PreferenceStorage; footer?: ReactNode; appearance?: Appearance; preview?: PreviewStyle; stylesheetScope?: string;
}) {
  const [pageId, setPage] = useState(plan.pages[0]!.id);
  const [values, setValues] = useState<Preferences>(() => normalizePreferences(plan, {}));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const page = plan.pages.find(page => page.id === pageId) ?? plan.pages[0]!;
  useEffect(() => {
    let current = true;
    void storage.load().then(saved => {
      if (!current) return;
      setValues(normalizePreferences(plan, saved));
      setReady(true);
    }).catch(reason => { if (current) setError(String(reason)); });
    return () => { current = false; };
  }, [plan, storage]);

  function change(key: string, value: Value) {
    setValues(old => ({ ...old, [key]: value }));
    setDirty(true);
    setStatus('');
  }
  async function save(next: Preferences, message: string) {
    await storage.save(next);
    setValues(next);
    setDirty(false);
    setStatus(message);
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setStatus('');
    setError('');
    try { await action(); } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  function exportPreferences() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(values, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'preferences.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Exported preferences');
  }
  const theme = typeof values.theme === 'string' ? values.theme.toLowerCase() : 'system';
  return <SpicaSurface appearance={appearance} theme={theme} preview={preview} stylesheetScope={stylesheetScope}>
    <aside className="spica-app-nav" data-spica-part="settings-sidebar">
      <strong data-spica-part="settings-name">{plan.name}</strong>
      <nav aria-label="Settings pages">
        {plan.pages.map(item => <SpicaAction key={item.id} part={'settings-tab-' + item.id}
          emphasis={page.id === item.id} onClick={() => setPage(item.id)}>{item.label}</SpicaAction>)}
      </nav>
      {footer && <div className="spica-app-footer" data-spica-part="app-footer">{footer}</div>}
    </aside>
    <section className="spica-app-page" aria-label={page.label} data-spica-part="settings-page">
      <h2 data-spica-part="settings-heading">{page.label}</h2>
      <form onSubmit={event => { event.preventDefault(); void perform(() => save(values, 'Preferences saved')); }}>
        <fieldset disabled={!ready || busy} data-spica-part="settings-fields">
          {page.controls.length === 0 && <p data-spica-part="settings-empty">This page has no settings yet.</p>}
          {page.controls.map(({ id, label, widget, definition }) => <div key={id} className="spica-field"
            data-spica-part={'setting-field-' + id}>
            {widget === 'toggle' ? <SpicaToggle label={label} part={'setting-input-' + id}
              checked={values[definition.key] === true} onChange={value => change(definition.key, value)} /> :
              widget === 'select' && definition.type === 'choice' ? <div className="spica-material-field">
                <span>{label}</span><SpicaOptionSelect label={label} part={'setting-input-' + id}
                  value={String(values[definition.key] ?? definition.initial)}
                  onChange={value => change(definition.key, value)}>
                  {definition.choices.map(choice => <option key={choice}>{choice}</option>)}
                </SpicaOptionSelect></div> :
                <SpicaTextInput label={label} part={'setting-input-' + id} multiline={widget === 'textarea'}
                  rows={widget === 'textarea' ? 6 : undefined} value={String(values[definition.key] ?? '')}
                  onChange={value => change(definition.key, value)} />}
          </div>)}
        </fieldset>
        <div className="spica-app-actions" data-spica-part="settings-actions">
          <SpicaAction type="submit" emphasis part="settings-save" disabled={!ready || busy || !dirty}>Save preferences</SpicaAction>
          <SpicaAction part="settings-export" disabled={!ready || busy} onClick={exportPreferences}>Export JSON</SpicaAction>
          <label className="spica-file" data-spica-part="settings-import">
            Import JSON
            <input aria-label="Import preferences JSON" type="file" accept=".json,application/json" disabled={!ready || busy}
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void perform(async () => {
                  if (file.size > 8_000_000) throw Error('Preference file exceeds 8 MB.');
                  const imported = normalizePreferences(plan, JSON.parse(await file.text()), true);
                  await save(imported, 'Preferences imported and saved');
                });
              }} />
          </label>
        </div>
        <p role="status" data-spica-part="settings-status">{status || (dirty ? 'Unsaved changes' : '')}</p>
        {error && <p role="alert" data-spica-part="settings-error">{error}</p>}
      </form>
    </section>
  </SpicaSurface>;
}
