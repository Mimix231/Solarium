import { Box, CheckCircle2, FolderOpen, Hammer, MonitorDown, PackageCheck, Play, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { buildDiagnostics } from "../editor/diagnostics";
import { buildGamePackage, revealBuildOutput, runBuiltGame } from "../editor/projectFile";
import { useEditorStore } from "../editor/store";
import { CommitNumberField, CommitTextField, Switch } from "./EditorControls";

export function BuildPanel() {
  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings);
  const setStatus = useEditorStore((state) => state.setStatus);
  const [building, setBuilding] = useState(false);
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const diagnostics = useMemo(() => buildDiagnostics(project), [project]);
  const buildErrors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const buildWarnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");

  function validate(): void {
    if (buildErrors.length > 0) {
      setStatus(`Build validation found ${buildErrors.length} error${buildErrors.length === 1 ? "" : "s"}`, "error");
      window.alert(buildErrors.map((diagnostic) => `• ${diagnostic.message}`).join("\n"));
      return;
    }
    setStatus(`Build validation passed with ${buildWarnings.length} warning${buildWarnings.length === 1 ? "" : "s"}`, buildWarnings.length ? "warning" : "runtime");
  }

  async function build(runAfterBuild = false): Promise<void> {
    setBuilding(true);
    try {
      const result = await buildGamePackage(project, projectPath);
      setLastOutput(result.outputPath);
      setStatus(`Game package built: ${result.outputPath ?? "browser downloads"}`, "runtime");
      if (runAfterBuild) {
        if (!result.outputPath) throw new Error("Build-and-run requires the desktop editor and a saved project.");
        await runBuiltGame(result.outputPath);
        setStatus(`Built and started ${project.metadata.name}`, "runtime");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Build failed: ${message}`, "error");
      window.alert(`Build failed.\n\n${message}`);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="build-workspace-panel">
      <section className="build-settings-card">
        <header className="phase-panel-header"><div><Hammer size={16} /><span>Windows Build Settings</span></div><span className="phase-chip">Phase 7G</span></header>
        <div className="build-settings-grid">
          <label><span>Game Name</span><input className="material-input" value={project.metadata.name} disabled /></label>
          <label><span>Executable Name</span><CommitTextField value={project.settings.executableName} onCommit={(executableName) => setProjectSettings({ executableName })} /></label>
          <label><span>Build Profile</span><select className="material-select" value={project.settings.buildProfile} onChange={(event) => setProjectSettings({ buildProfile: event.target.value as typeof project.settings.buildProfile })}><option value="development">Development</option><option value="release">Release</option><option value="distribution">Distribution</option></select></label>
          <label><span>Scaling Mode</span><select className="material-select" value={project.settings.scalingMode} onChange={(event) => setProjectSettings({ scalingMode: event.target.value as typeof project.settings.scalingMode })}><option value="fit">Fit</option><option value="integer">Integer Scale</option><option value="stretch">Stretch</option></select></label>
          <label><span>Version</span><CommitTextField value={project.settings.versionName} onCommit={(versionName) => setProjectSettings({ versionName })} /></label>
          <label><span>Company</span><CommitTextField value={project.settings.companyName} onCommit={(companyName) => setProjectSettings({ companyName })} /></label>
          <label><span>Output Folder</span><CommitTextField value={project.settings.buildOutput} onCommit={(buildOutput) => setProjectSettings({ buildOutput })} /></label>
          <label><span>Game Width</span><CommitNumberField value={project.settings.gameWidth} minimum={320} maximum={7680} onCommit={(gameWidth) => setProjectSettings({ gameWidth })} /></label>
          <label><span>Game Height</span><CommitNumberField value={project.settings.gameHeight} minimum={180} maximum={4320} onCommit={(gameHeight) => setProjectSettings({ gameHeight })} /></label>
          <label className="build-switch"><span>Resizable</span><Switch checked={project.settings.resizable} onChange={(resizable) => setProjectSettings({ resizable })} /></label>
          <label className="build-switch"><span>VSync</span><Switch checked={project.settings.vsync} onChange={(vsync) => setProjectSettings({ vsync })} /></label>
          <label className="build-switch"><span>Start Fullscreen</span><Switch checked={project.settings.fullscreen} onChange={(fullscreen) => setProjectSettings({ fullscreen })} /></label>
          <label className="build-switch"><span>Pixel Perfect</span><Switch checked={project.settings.pixelPerfect} onChange={(pixelPerfect) => setProjectSettings({ pixelPerfect })} /></label>
        </div>
      </section>

      <section className="build-summary-card">
        <header><MonitorDown size={26} /><div><strong>Native Windows Build</strong><p>Validates the project, copies the shared Shadowium runtime as a game executable, writes runtime-only data, packs assets, and keeps an HTML development fallback.</p></div></header>
        <div className="build-check-list">
          <span><CheckCircle2 size={15} /> Initial scene: {project.scenes.find((scene) => scene.id === project.settings.initialSceneId)?.name ?? "Missing"}</span>
          <span><CheckCircle2 size={15} /> {project.scenes.length} scenes · {project.scenes.reduce((sum, scene) => sum + scene.objects.length, 0)} objects</span>
          <span><CheckCircle2 size={15} /> {project.assets.length} assets · {project.eventRules.length} event rules</span>
          <span><CheckCircle2 size={15} /> Runtime save slots: {project.settings.saveSlots}</span>
          <span className={buildErrors.length ? "build-check-error" : ""}><CheckCircle2 size={15} /> Preflight: {buildErrors.length} errors · {buildWarnings.length} warnings</span>
        </div>
        <div className="build-action-row">
          <button className="material-button text" type="button" disabled={building} onClick={validate}><ShieldCheck size={16} /> Validate</button>
          <button className="material-button filled build-game-button" type="button" disabled={building || buildErrors.length > 0} onClick={() => void build(false)}>
            {building ? <Box size={17} /> : <PackageCheck size={17} />} {building ? "Building…" : "Build Game"}
          </button>
          <button className="material-button tonal" type="button" disabled={building || buildErrors.length > 0 || !projectPath} onClick={() => void build(true)}><Play size={16} /> Build and Run</button>
        </div>
        {buildErrors.length > 0 && <small className="build-warning">Resolve the build-blocking errors in Diagnostics before packaging the game.</small>}
        {!projectPath && <small className="build-warning">Save the project to a folder first for a full asset-copying native build. Browser mode exports development files as downloads.</small>}
        {lastOutput && <div className="build-output"><FolderOpen size={15} /><span>{lastOutput}</span><button type="button" onClick={() => void revealBuildOutput(lastOutput)}>Open Folder</button></div>}
      </section>
    </div>
  );
}
