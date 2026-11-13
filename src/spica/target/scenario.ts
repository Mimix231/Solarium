import { allRecords, type CollectionStore } from '../data';
import type { Scenario, ScenarioStep } from '../program';

export interface ScenarioReport {
  id: string; phase: 'initial' | 'reopen'; state: 'passed' | 'failed'; completed: number;
  failedStep?: ScenarioStep; diagnostic?: string; durationMs: number;
}

export interface LayoutIssue { block: string; kind: 'focus' | 'overflow'; message: string }

export function auditLayout(root: HTMLElement, checkKeyboard = true): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const visible = (element: HTMLElement) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const block = (element: HTMLElement) => element.closest<HTMLElement>('[data-spica-part]')?.dataset.spicaPart ?? 'app';
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('[data-spica-part]'))]) {
    if (visible(element) && element.clientWidth && element.scrollWidth > element.clientWidth + 2 &&
        !['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) {
      issues.push({ block: block(element), kind: 'overflow', message: 'Content exceeds the available width.' });
    }
  }
  const focusRoot = root.getRootNode() as Document | ShadowRoot;
  const hasWindowFocus = checkKeyboard && root.ownerDocument.hasFocus();
  const before = focusRoot.activeElement;
  try {
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('button:enabled, input:enabled, select:enabled, textarea:enabled, a[href], summary'))) {
      if (!visible(element)) continue;
      if (hasWindowFocus) element.focus({ preventScroll: true });
      if (element.tabIndex < 0 || element.closest('[inert]') || (hasWindowFocus && focusRoot.activeElement !== element)) {
        const label = element.getAttribute('aria-label') ?? element.closest('label')?.textContent?.trim();
        issues.push({ block: block(element), kind: 'focus', message: `${label || element.localName} cannot receive keyboard focus.` });
      }
    }
  } finally {
    if (hasWindowFocus && before instanceof HTMLElement) before.focus({ preventScroll: true });
  }
  return issues.filter((issue, index) => issues.findIndex(item => item.kind === issue.kind && item.block === issue.block) === index);
}

function enterValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
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
  phase: ScenarioReport['phase'], signal?: AbortSignal, readExport?: () => string | undefined): Promise<ScenarioReport> {
  const started = performance.now();
  const report: ScenarioReport = { id: scenario.id, phase, state: 'passed', completed: 0, durationMs: 0 };
  const steps = phase === 'initial' ? scenario.steps : scenario.reopened ?? [];
  const route = () => root.querySelector<HTMLElement>('[data-spica-screen]');
  const field = (key: string) => route()?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-spica-field="${key}"]`);
  const transfer = (operation: string) => route()?.querySelector<HTMLButtonElement>(`[data-spica-transfer="${operation}"]`);
  async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await waitFor(() => !root.querySelector('[data-spica-busy="true"]') ? true : undefined, signal);
  }
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
            if (typeof step.value === 'boolean') throw Error('This control requires a text or numeric value.');
            enterValue(input, String(step.value));
          }
          await new Promise(resolve => setTimeout(resolve, 0));
          break;
        }
        case 'submit': {
          const button = await waitFor(() => route()?.querySelector<HTMLButtonElement>('[data-spica-submit]:enabled') ?? undefined, signal);
          button.click();
          if (step.twice) button.click();
          await settle();
          break;
        }
        case 'load_csv': {
          const input = await waitFor(() => route()?.querySelector<HTMLInputElement>('[data-spica-import-file]:enabled') ?? undefined, signal)
            .catch(error => {
              if (signal?.aborted) throw error;
              throw Error('CSV import control is unavailable. Check the review screen and its files.open and records.write grants.');
            });
          const data = new DataTransfer();
          data.items.add(new File([step.text], 'scenario.csv', { type: 'text/csv' }));
          input.files = data.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await settle();
          const error = route()?.querySelector('[data-spica-transfer-alert]')?.textContent;
          if (error) throw Error(error);
          break;
        }
        case 'edit_cell': {
          const row = () => route()?.querySelector<HTMLElement>(`[data-spica-csv-row="${step.row}"]`);
          while (!row()) {
            const first = Number(route()?.querySelector<HTMLElement>('[data-spica-csv-row]')?.dataset.spicaCsvRow);
            const selector = step.row < first ? '[data-spica-csv-previous]:enabled' : '[data-spica-csv-next]:enabled';
            const button = route()?.querySelector<HTMLButtonElement>(selector);
            if (!button || signal?.aborted) throw Error(`Staged row ${step.row} is unavailable.`);
            button.click();
            await waitFor(() => Number(route()?.querySelector<HTMLElement>('[data-spica-csv-row]')?.dataset.spicaCsvRow) !== first ? true : undefined, signal);
          }
          const input = row()?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-spica-csv-field="${step.field}"]`);
          if (!input || input.disabled) throw Error(`Row ${step.row} field ${step.field} is unavailable.`);
          enterValue(input, String(step.value));
          await settle();
          break;
        }
        case 'map_column': {
          const select = await waitFor(() => route()?.querySelector<HTMLSelectElement>(`[data-spica-map-column="${step.column}"]:enabled`) ?? undefined, signal);
          enterValue(select, step.field);
          await settle();
          break;
        }
        case 'stage_csv': {
          const button = await waitFor(() => route()?.querySelector<HTMLButtonElement>('[data-spica-stage-csv]:enabled') ?? undefined, signal);
          button.click();
          await settle();
          break;
        }
        case 'table_query': {
          if (step.text !== undefined) {
            const search = await waitFor(() => route()?.querySelector<HTMLInputElement>('[data-spica-part="record-search"]') ?? undefined, signal);
            enterValue(search, step.text);
          }
          if (step.filter !== undefined) {
            const filter = await waitFor(() => route()?.querySelector<HTMLInputElement>('[data-spica-table-filter]') ?? undefined, signal);
            if (filter.checked !== step.filter) filter.click();
          }
          if (step.sort !== undefined) {
            const sort = await waitFor(() => route()?.querySelector<HTMLSelectElement>('[data-spica-sort]') ?? undefined, signal);
            enterValue(sort, step.sort);
          }
          if (step.direction !== undefined) {
            const direction = await waitFor(() => route()?.querySelector<HTMLSelectElement>('[data-spica-sort-direction]') ?? undefined, signal);
            enterValue(direction, step.direction);
          }
          await settle();
          await waitFor(() => route()?.querySelector('[aria-busy="false"]') ? true : undefined, signal);
          break;
        }
        case 'transfer': {
          const button = await waitFor(() => {
            const candidate = transfer(step.operation);
            return candidate && !candidate.disabled ? candidate : undefined;
          }, signal).catch(error => {
            if (signal?.aborted) throw error;
            throw Error(step.operation === 'csv' ? 'CSV export control is unavailable. Check the files.export grant.' :
              'Import remains blocked. Check the staged row errors and record write grant.');
          });
          button.click();
          await settle();
          const error = route()?.querySelector('[data-spica-transfer-alert]')?.textContent;
          if (error) throw Error(error);
          break;
        }
        case 'move_player': {
          const viewport = await waitFor(() => route()?.querySelector('[data-spica-game]') ?? undefined, signal);
          const key = 'Arrow' + step.direction[0]!.toUpperCase() + step.direction.slice(1);
          viewport.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
          await settle();
          break;
        }
        case 'expect': {
          await waitFor(() => {
            const current = route();
            if (!current || (step.screen && current.dataset.spicaScreen !== step.screen)) return undefined;
            if (step.alert && current.querySelector('[data-spica-flow-alert], [data-spica-transfer-alert]')?.textContent !== step.alert) return undefined;
            const staged = current.querySelector<HTMLElement>('[data-spica-staged]');
            if (step.stagedRows !== undefined && Number(staged?.dataset.spicaStaged ?? 0) !== step.stagedRows) return undefined;
            if (step.invalidRows !== undefined && Number(staged?.dataset.spicaInvalid ?? 0) !== step.invalidRows) return undefined;
            if (step.importBlocked !== undefined && transfer('import')?.disabled !== step.importBlocked) return undefined;
            if (step.exportIncludes && !readExport?.()?.includes(step.exportIncludes)) return undefined;
            const game = current.querySelector<HTMLElement>('[data-spica-game]');
            if (step.playerAt && (!game || Number(game.dataset.playerX) !== step.playerAt[0] || Number(game.dataset.playerY) !== step.playerAt[1])) return undefined;
            if (step.goalReached !== undefined && game?.dataset.goalReached !== String(step.goalReached)) return undefined;
            if (step.field) {
              const input = field(step.field);
              if (!input || (typeof step.value === 'boolean' ? (input as HTMLInputElement).checked !== step.value : input.value !== String(step.value))) return undefined;
            }
            if (step.firstRow && current.querySelector('[data-spica-part="record-row"]')?.textContent !== step.firstRow) return undefined;
            if (step.badge && current.querySelector('[data-spica-part="record-badge"]')?.textContent !== step.badge) return undefined;
            if (step.row) {
              const matches = Array.from(current.querySelectorAll('[data-spica-part="record-row"]')).filter(row => row.textContent === step.row);
              if (matches.length !== (step.count ?? 1)) return undefined;
            }
            return true;
          }, signal);
          if (step.layoutClean !== undefined) {
            // The native runner stays hidden. Interactive focus is checked from the visible preview.
            const issues = auditLayout(root.querySelector<HTMLElement>('.spica-app') ?? root, false);
            if ((issues.length === 0) !== step.layoutClean) throw Error(issues.map(issue => `${issue.block} · ${issue.message}`).join(' ') || 'Expected a layout issue.');
          }
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
