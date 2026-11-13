import { AlertCircle, AlertTriangle, CheckCircle2, Info, LocateFixed, Wrench } from "lucide-react";
import { buildDiagnostics } from "../editor/diagnostics";
import { useEditorStore } from "../editor/store";
import type { DiagnosticEntry } from "../editor/types";

function canRepair(diagnostic: DiagnosticEntry): boolean {
  return diagnostic.id === "project:missing-initial-scene" ||
    diagnostic.id.endsWith(":no-camera") ||
    diagnostic.id.endsWith(":missing-scene-layer") ||
    diagnostic.id.includes(":missing-parent");
}

export function DiagnosticsPanel() {
  const project = useEditorStore((state) => state.project);
  const focusDiagnostic = useEditorStore((state) => state.focusDiagnostic);
  const repairDiagnostic = useEditorStore((state) => state.repairDiagnostic);
  const diagnostics = buildDiagnostics(project);
  const errors = diagnostics.filter((item) => item.severity === "error").length;
  const warnings = diagnostics.filter((item) => item.severity === "warning").length;
  const information = diagnostics.filter((item) => item.severity === "info").length;

  return (
    <div className="diagnostics-panel phase5-diagnostics-panel">
      <div className="diagnostic-summary-row">
        <span className="diagnostic-summary error"><AlertCircle size={15} /> {errors} Errors</span>
        <span className="diagnostic-summary warning"><AlertTriangle size={15} /> {warnings} Warnings</span>
        <span className="diagnostic-summary info"><Info size={15} /> {information} Information</span>
      </div>

      {diagnostics.length === 0 ? (
        <div className="bottom-empty-state success-state">
          <CheckCircle2 size={36} />
          <div><strong>No configuration problems found</strong><span>The current project passes Phase 7 validation.</span></div>
        </div>
      ) : (
        <div className="diagnostic-list">
          {diagnostics.map((diagnostic) => (
            <article key={diagnostic.id} className={`diagnostic-row-wrap ${diagnostic.severity}`}>
              <button className={`diagnostic-row ${diagnostic.severity}`} type="button" onClick={() => focusDiagnostic(diagnostic)}>
                {diagnostic.severity === "error" ? <AlertCircle size={16} /> : diagnostic.severity === "warning" ? <AlertTriangle size={16} /> : <Info size={16} />}
                <span>{diagnostic.message}</span>
                <small><LocateFixed size={12} /> {diagnostic.objectId ? "Open object" : diagnostic.sceneId ? "Open scene" : "Project"}</small>
              </button>
              {canRepair(diagnostic) && (
                <button className="diagnostic-repair-button" type="button" onClick={() => repairDiagnostic(diagnostic)}>
                  <Wrench size={14} /> Repair
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
