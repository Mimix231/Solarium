import { allRecords, type CollectionStore } from '../data';
import type { Scenario, ScenarioStep } from '../program';

export interface ScenarioReport {
  id: string; phase: 'initial' | 'reopen'; state: 'passed' | 'failed'; completed: number;
  failedStep?: ScenarioStep; diagnostic?: string; durationMs: number;
}

async function waitFor<T>(read: () => T | undefined, signal?: AbortSignal): Promise<T> {
  const expires = Date.now() + 4500;
  while (Date.now() < expires) {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const value = read();
    if (value !== undefined) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Error('The expected application state was not reached.');
}

export async function runScenario(root: HTMLElement, records: CollectionStore, scenario: Scenario,
  phase: ScenarioReport['phase'], signal?: AbortSignal): Promise<ScenarioReport> {
  const started = performance.now();
  const report: ScenarioReport = { id: scenario.id, phase, state: 'passed', completed: 0, durationMs: 0 };
  const steps = phase === 'initial' ? scenario.steps : scenario.reopened ?? [];
  const route = () => root.querySelector<HTMLElement>('[data-spica-screen]');
  const field = (key: string) => route()?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-spica-field="${key}"]`);
  try {
    for (const step of steps) {
      report.failedStep = step;
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      switch (step.action) {
        case 'screen': {
          const button = await waitFor(() => root.querySelector<HTMLButtonElement>(`[data-spica-route="${step.screen}"]:enabled`) ?? undefined, signal);
          button.click();
          await waitFor(() => route()?.dataset.spicaScreen === step.screen ? true : undefined, signal);
          break;
        }
        case 'fill': {
          const input = await waitFor(() => field(step.field) ?? undefined, signal);
          if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            if (typeof step.value !== 'boolean') throw Error('A checkbox requires a Boolean value.');
            if (input.checked !== step.value) input.click();
          } else {
            if (typeof step.value !== 'string' || input instanceof HTMLSelectElement) throw Error('This field requires text input.');
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, step.value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          await new Promise(resolve => setTimeout(resolve, 0));
          break;
        }
        case 'submit': {
          const button = await waitFor(() => route()?.querySelector<HTMLButtonElement>('[data-spica-submit]:enabled') ?? undefined, signal);
          button.click();
          if (step.twice) button.click();
          await new Promise(resolve => setTimeout(resolve, 0));
          await waitFor(() => !root.querySelector('[data-spica-busy="true"]') ? true : undefined, signal);
          break;
        }
        case 'expect': {
          await waitFor(() => {
            const current = route();
            if (!current || (step.screen && current.dataset.spicaScreen !== step.screen)) return undefined;
            if (step.alert && current.querySelector('[data-spica-flow-alert]')?.textContent !== step.alert) return undefined;
            if (step.field) {
              const input = field(step.field);
              if (!input || (typeof step.value === 'boolean' ? (input as HTMLInputElement).checked : input.value) !== step.value) return undefined;
            }
            if (step.row) {
              const matches = Array.from(current.querySelectorAll('[data-spica-part="record-row"]')).filter(row => row.textContent === step.row);
              if (matches.length !== (step.count ?? 1)) return undefined;
            }
            return true;
          }, signal);
          if (step.stored !== undefined) {
            const collection = route()?.dataset.spicaCollection;
            if (!collection) throw Error('There is no active collection to inspect.');
            const stored = (await allRecords(records, collection)).length;
            if (stored !== step.stored) throw Error(`Expected ${step.stored} stored records, found ${stored}.`);
          }
          break;
        }
      }
      report.completed++;
    }
    delete report.failedStep;
  } catch (error) {
    report.state = 'failed';
    const current = route()?.dataset.spicaScreen ?? 'none';
    report.diagnostic = `Step ${report.completed + 1} (${report.failedStep?.action ?? 'scenario'}), screen ${current} · ${String(error)}`;
  }
  report.durationMs = performance.now() - started;
  return report;
}
