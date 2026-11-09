import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  normalizeStyleValue, styleProperties, styleTargets, styleValues, supportedProperties, supportedStates,
  type StyleEdit, type StyleProperty, type StyleState,
} from '../spica/appearance';
import { changeGraph, compileGraph, stableGraphJson, type AppPlan } from '../spica/graph';
import type { SpicaRecord } from '../spica/repository';
import { memoryAdapters } from '../spica/data';
import type { FlowTrace, ProgramEdit, Scenario, ScenarioStep } from '../spica/program';
import { runScenario, type ScenarioReport } from '../spica/target/scenario';
import { SpicaApp } from '../spica/target/SpicaApp';
import '../spica/target/settings.css';
import './spica-preview.css';

export type PreviewMode = 'closed' | 'dock' | 'overlay';
const stateLabels = { base: 'Default', hover: 'Hover', selected: 'Selected', focus: 'Keyboard focus' };

interface Props {
  record: SpicaRecord;
  mode: PreviewMode;
  onMode(mode: PreviewMode): void;
  verification?: string;
  error?: string;
  onLaunch?(): void;
  onEdit?(edit: StyleEdit): Promise<void>;
  onProgramEdit?(edit: ProgramEdit): Promise<void>;
  saving?: boolean;
}

export function SpicaPreview({ record, mode, onMode, verification, error, onLaunch, onEdit, onProgramEdit, saving }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState('wide');
  const [inspector, setInspector] = useState(false);
  const [picking, setPicking] = useState(false);
  const [targetId, setTarget] = useState('app');
  const [state, setState] = useState<StyleState>('base');
  const [property, setProperty] = useState<StyleProperty>('scheme');
  const [draft, setDraft] = useState<{ key: string; value: string }>();
  const [trace, setTrace] = useState<FlowTrace[]>([]);
  const [recording, setRecording] = useState<ScenarioStep[] | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState('');
  const [replay, setReplay] = useState<{ scenario: Scenario; key: number }>();
  const viewportRef = useRef<HTMLDivElement>(null);
  const { graph, revision } = record.data;
  const targets = useMemo(() => styleTargets(graph), [graph]);
  const part = targets.find(part => part.id === targetId) ?? targets[0]!;
  const states = supportedStates(part);
  const activeState = states.includes(state) ? state : 'base';
  const properties = supportedProperties(part, activeState);
  const activeProperty = properties.includes(property) ? property : properties[0]!;
  const spec = styleProperties[activeProperty];
  const saved = styleValues(graph.appearance, part.id, activeState)[activeProperty];
  const key = `${revision}/${part.id}/${activeState}/${activeProperty}`;
  const input = draft?.key === key ? draft.value : String(saved ?? spec.fallback);
  const edit: StyleEdit = { op: 'set_style', target: part.id, state: activeState, property: activeProperty, value: null };
  const design = useMemo(() => {
    const plan = compileGraph(graph);
    return stableGraphJson({ ...plan, appearance: undefined });
  }, [graph]);
  // A style revision updates the same renderer and keeps in-progress sample edits.
  const plan = useMemo(() => JSON.parse(design) as AppPlan, [design]);
  const samples = useMemo(() => memoryAdapters(plan, true), [plan]);
  let appearance = graph.appearance;
  let validation = '';
  let change: StyleEdit | undefined;
  const changed = draft?.key === key;
  if (changed) {
    try {
      const value = normalizeStyleValue(activeProperty, spec.type === 'number' && input.trim() ? Number(input) : input);
      if (value !== saved) {
        change = { ...edit, value };
        appearance = changeGraph(graph, [change]).appearance;
      }
    } catch (error) { validation = error instanceof Error ? error.message : String(error); }
  }

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element.open && mode !== 'closed') openedFrom.current = previousFocus;
    if (element.open) element.close();
    if (mode === 'overlay') element.showModal();
    if (mode === 'dock') element.show();
    if (mode === 'closed') {
      openedFrom.current?.focus({ preventScroll: true });
      openedFrom.current = null;
    } else if (previousFocus && element.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }, [mode]);

  function choose(id: string) {
    setTarget(id);
    setState('base');
    setDraft(undefined);
  }
  function selectBlock(event: MouseEvent<HTMLDivElement>) {
    const viewport = event.currentTarget.parentElement;
    const block = document.elementsFromPoint(event.clientX, event.clientY)
      .map(element => element.closest<HTMLElement>('[data-spica-part]'))
      .find(element => element && viewport?.contains(element));
    if (block?.dataset.spicaPart) choose(block.dataset.spicaPart);
    setPicking(false);
  }

  function recordAction(step: ScenarioStep) {
    setRecording(previous => {
      if (!previous) return null;
      const last = previous.at(-1);
      if (step.action === 'fill' && last?.action === 'fill' && last.field === step.field) return [...previous.slice(0, -1), step];
      return previous.length < 59 ? [...previous, step] : previous;
    });
  }
  function beginRecording() {
    const screen = viewportRef.current?.querySelector<HTMLElement>('[data-spica-screen]')?.dataset.spicaScreen;
    setRecording(screen ? [{ action: 'screen', screen }] : []);
  }
  function captureExpectation() {
    const section = viewportRef.current?.querySelector<HTMLElement>('[data-spica-screen]');
    if (!section?.dataset.spicaScreen) return;
    const alert = section.querySelector('[data-spica-flow-alert]')?.textContent;
    const row = section.querySelector('[data-spica-part="record-row"]')?.textContent;
    recordAction({ action: 'expect', screen: section.dataset.spicaScreen, ...(alert ? { alert } : row ? { row } : {}) });
  }

  return <dialog ref={dialog} className="spica-preview-dialog" data-mode={mode} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onMode(mode === 'overlay' ? 'dock' : 'closed'); }}>
    <header className="spica-preview-header">
      <div>
        <h2 id={titleId}>App preview</h2>
        <p>Sample data · {plan.name} · Graph revision {revision}{change ? ' · Style draft' : ''}</p>
      </div>
      <div className="spica-preview-buttons">
        <button type="button" onClick={() => onMode(mode === 'overlay' ? 'dock' : 'overlay')}>{mode === 'overlay' ? 'Dock preview' : 'Expand preview'}</button>
        <button type="button" onClick={() => onMode('closed')}>Close preview</button>
      </div>
    </header>
    <div className="spica-preview-toolbar">
      <div className="spica-preview-buttons" role="group" aria-label="Preview width">
        <button type="button" aria-pressed={width === 'compact'} onClick={() => setWidth('compact')}>Compact</button>
        <button type="button" aria-pressed={width === 'wide'} onClick={() => setWidth('wide')}>Wide</button>
      </div>
      {onEdit && <button type="button" aria-expanded={inspector} onClick={() => { setInspector(value => !value); setPicking(false); }}>Appearance</button>}
      <span role="status">{verification ?? 'Sample app'}</span>
      {onLaunch && <button type="button" onClick={onLaunch}>Launch verified app</button>}
    </div>
    {error && <p className="spica-preview-error" role="alert">{error}</p>}
    <div className="spica-preview-scroll">
      <div ref={viewportRef} className="spica-preview-viewport" data-width={width}>
        <SpicaApp key={design} plan={plan} appearance={inspector ? appearance : graph.appearance} {...samples}
          onTrace={setTrace} onAction={recording ? recordAction : undefined}
          preview={inspector ? { target: part.id, state: activeState, inspect: picking } : undefined} />
        {inspector && picking && <div className="spica-pick-layer" aria-hidden="true" onClick={selectBlock} />}
      </div>
    </div>
    {plan.program?.screens.length ? <details className="spica-flow-inspector" open={recording ? true : undefined}>
      <summary>Behavior and scenarios{trace.length ? ` · ${trace.length} actions` : ''}</summary>
      {trace.length > 0 && <ol aria-label="Latest action trace">{trace.map(step => <li key={`${step.flow}/${step.step}`}>
        <strong>{step.flow}/{step.step}</strong> · {step.action} · {step.outcome}{step.detail && ` · ${step.detail}`}
      </li>)}</ol>}
      <div className="spica-preview-buttons">
        {plan.program.scenarios.map(scenario => <button type="button" key={scenario.id} onClick={() => setReplay({ scenario, key: Date.now() })}>Replay {scenario.label}</button>)}
        {onProgramEdit && !recording && <button type="button" disabled={saving} onClick={beginRecording}>Record interaction</button>}
      </div>
      {onProgramEdit && recording && <div className="spica-recording">
        <p>{recording.length} steps recorded. Assertions capture the current screen and its first visible record or flow error.</p>
        <label>Scenario name<input value={scenarioLabel} maxLength={100} onChange={event => setScenarioLabel(event.target.value)} /></label>
        <div className="spica-preview-buttons"><button type="button" disabled={recording.length >= 60} onClick={captureExpectation}>Capture assertion</button>
          <button type="button" disabled={saving || !scenarioLabel.trim() || !recording.some(step => step.action === 'expect')} onClick={() => {
            const scenario = { id: 'recorded_' + Date.now(), label: scenarioLabel.trim(), steps: recording };
            void onProgramEdit({ op: 'put_scenario', scenario });
            setRecording(null); setScenarioLabel('');
          }}>Save recorded scenario</button>
          <button type="button" onClick={() => setRecording(null)}>Discard recording</button></div>
      </div>}
      {replay && <ScenarioReplay key={`${revision}/${replay.key}`} plan={plan} scenario={replay.scenario} appearance={graph.appearance} onClose={() => setReplay(undefined)} />}
    </details> : null}
    {onEdit && inspector && <section className="spica-style-inspector" aria-label="Appearance inspector">
      <div className="spica-style-heading">
        <div><strong>Appearance inspector</strong><p aria-live="polite">{picking ? 'Click an element in the preview' : part.label + ' · ' + part.id}</p></div>
        <button type="button" aria-pressed={picking} onClick={() => setPicking(value => !value)}>{picking ? 'Cancel picking' : 'Pick a block'}</button>
      </div>
      <form onSubmit={event => { event.preventDefault(); if (change && !saving) void onEdit(change); }}>
        <label>Block<select value={part.id} onChange={event => choose(event.target.value)}>
          {targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select></label>
        <label>State<select value={activeState} onChange={event => { setState(event.target.value as StyleState); setDraft(undefined); }}>
          {states.map(state => <option key={state} value={state}>{stateLabels[state]}</option>)}
        </select></label>
        <label>Property<select value={activeProperty} onChange={event => { setProperty(event.target.value as StyleProperty); setDraft(undefined); }}>
          {properties.map(property => <option key={property} value={property}>{styleProperties[property].label}</option>)}
        </select></label>
        <div className="spica-style-value">
          <label>Value{spec.type === 'choice' ? <select value={input} onChange={event => setDraft({ key, value: event.target.value })}>
            {spec.choices.map(choice => <option key={choice}>{choice}</option>)}
          </select> : <input value={input} type={spec.type === 'number' ? 'number' : 'text'} aria-invalid={!!validation}
            min={spec.type === 'number' ? spec.min : undefined} max={spec.type === 'number' ? spec.max : undefined}
            maxLength={spec.type === 'color' ? 7 : undefined} onChange={event => setDraft({ key, value: event.target.value })} />}</label>
          {spec.type === 'color' && <input type="color" aria-label="Choose color" value={/^#[a-f\d]{6}$/i.test(input) ? input : String(spec.fallback)}
            onChange={event => setDraft({ key, value: event.target.value })} />}
        </div>
        <div className="spica-preview-buttons spica-style-actions">
          <button type="submit" disabled={saving || !change}>Save style</button>
          <button type="button" disabled={saving || saved === undefined} onClick={() => void onEdit(edit)}>Inherit</button>
          {changed && <button type="button" onClick={() => setDraft(undefined)}>Discard draft</button>}
        </div>
      </form>
      <p role={validation ? 'alert' : undefined}>{validation || (saved === undefined ? 'Inherits the app or recipe default.' : `Saved value ${saved}.`)}{activeState !== 'base' && ' Showing the selected state in the sample.'}</p>
    </section>}
  </dialog>;
}

function ScenarioReplay({ plan, scenario, appearance, onClose }: { plan: AppPlan; scenario: Scenario; appearance: AppPlan['appearance']; onClose(): void }) {
  const [phase, setPhase] = useState<ScenarioReport['phase']>('initial');
  const [reports, setReports] = useState<ScenarioReport[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const store = useMemo(() => memoryAdapters(plan), [plan]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void runScenario(element, store.records, scenario, phase, controller.signal).then(report => {
        if (controller.signal.aborted) return;
        setReports(old => [...old, report]);
        if (report.state === 'passed' && phase === 'initial' && scenario.reopened?.length) setPhase('reopen');
      });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [phase, scenario, store]);
  return <section className="spica-scenario-replay" aria-label="Isolated sample replay">
    <header><strong>{scenario.label} · Sample replay</strong><button type="button" onClick={onClose}>Close replay</button></header>
    <ul role="status">{reports.map(report => <li key={report.phase}>{report.phase === 'reopen' ? 'View remount' : 'Initial run'} · {report.state} · {report.completed} steps{report.diagnostic && ` · ${report.diagnostic}`}</li>)}</ul>
    <div ref={root}><SpicaApp key={phase} plan={plan} {...store} appearance={appearance} /></div>
  </section>;
}
