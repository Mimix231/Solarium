import type { ReactNode } from 'react';
import { STANDALONE_STYLE_SCOPE, type Appearance, type PreviewStyle } from '../appearance';
import type { AppPlan } from '../graph';
import { CollectionApp, type CollectionStore } from './CollectionApp';
import { SettingsApp, SpicaSurface, type PreferenceStorage } from './SettingsApp';
import { WorkflowApp, type SaveExport } from './WorkflowApp';
import type { CsvTransform } from '../data';
import type { FlowTrace, ScenarioStep } from '../program';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';

export function SpicaApp({ plan, storage, records, appearance = plan.appearance, preview, footer, standalone, saveExport, transform, onTrace, onAction }: {
  plan: AppPlan; storage: PreferenceStorage; records: CollectionStore;
  appearance?: Appearance; preview?: PreviewStyle; footer?: ReactNode; standalone?: boolean;
  saveExport?: SaveExport; transform?: CsvTransform; onTrace?(trace: FlowTrace[]): void; onAction?(step: ScenarioStep): void;
}) {
  const label = footer ?? plan.collection?.label ?? plan.pages.length + ' settings pages';
  const hasProgram = Boolean(plan.program?.screens.length);
  const authoredScreens = hasProgram || Boolean(plan.collection);
  const stylesheetScope = standalone ? STANDALONE_STYLE_SCOPE : undefined;
  const settings = <SettingsApp plan={plan} storage={storage} appearance={appearance} preview={preview}
    stylesheetScope={stylesheetScope} footer={authoredScreens ? undefined : label} />;
  return authoredScreens ? <SpicaSurface appearance={appearance} preview={preview} stylesheetScope={stylesheetScope}>
    {hasProgram ? <WorkflowApp plan={plan} storage={records} saveExport={saveExport} transform={transform} onTrace={onTrace} onAction={onAction} /> :
      <CollectionApp collection={plan.collection!} storage={records} program={plan.program} />}
    {plan.pages.some(page => page.controls.length) && <Accordion className="spica-record-settings"
      data-spica-part="record-settings" disableGutters>
      <AccordionSummary data-spica-part="record-settings-summary">Settings and preferences</AccordionSummary>
      <AccordionDetails>{settings}</AccordionDetails>
    </Accordion>}
    <p className="spica-app-footer" data-spica-part="app-footer">{label}</p>
  </SpicaSurface> : settings;
}
