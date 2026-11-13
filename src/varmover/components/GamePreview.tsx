import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Activity,
  Bot,
  Braces,
  Bug,
  Focus,
  Map,
  Maximize2,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  SkipForward,
  Square,
  Swords,
  WandSparkles,
  X,
  Minus,
  Copy,
} from "lucide-react";
import { RUNTIME_SNAPSHOT_EVENT, RUNTIME_STEP_EVENT } from "../editor/runtimePreview";
import type { RuntimePreviewSnapshot } from "../editor/runtimePreview";
import { createRuntimeSession, disposeActiveRuntimeSession, getRuntimeSession, RUNTIME_SESSION_STATE_EVENT } from "../editor/runtimeSession";
import type { RuntimeSessionSnapshot } from "../editor/runtimeSession";
import { useEditorStore } from "../editor/store";
import { SceneViewport } from "./SceneViewport";

function CameraPreviewMinimap({ snapshot }: { snapshot: RuntimePreviewSnapshot | null }) {
  const geometry = useMemo(() => {
    if (!snapshot) return null;
    const left = Math.min(snapshot.worldBounds.left, snapshot.cameraView.left);
    const right = Math.max(snapshot.worldBounds.right, snapshot.cameraView.right);
    const top = Math.min(snapshot.worldBounds.top, snapshot.cameraView.top);
    const bottom = Math.max(snapshot.worldBounds.bottom, snapshot.cameraView.bottom);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const paddingX = width * 0.08;
    const paddingY = height * 0.08;
    return {
      left: left - paddingX,
      top: top - paddingY,
      width: width + paddingX * 2,
      height: height + paddingY * 2,
    };
  }, [snapshot]);

  if (!snapshot || !geometry) {
    return (
      <aside className="runtime-camera-minimap loading">
        <header><Map size={14} /><strong>Camera Preview</strong></header>
        <div className="runtime-minimap-empty">Waiting for the runtime scene…</div>
      </aside>
    );
  }

  const toX = (value: number) => ((value - geometry.left) / geometry.width) * 100;
  const toY = (value: number) => ((value - geometry.top) / geometry.height) * 100;
  const toWidth = (value: number) => (value / geometry.width) * 100;
  const toHeight = (value: number) => (value / geometry.height) * 100;

  return (
    <aside className="runtime-camera-minimap">
      <header>
        <div><Map size={14} /><strong>Camera Preview</strong></div>
        <span>{Math.round(snapshot.cameraFov)}° FOV</span>
      </header>
      <div className="runtime-minimap-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Runtime world and camera minimap">
          <rect
            className="runtime-minimap-world"
            x={toX(snapshot.worldBounds.left)}
            y={toY(snapshot.worldBounds.top)}
            width={toWidth(snapshot.worldBounds.width)}
            height={toHeight(snapshot.worldBounds.height)}
          />
          {snapshot.objects.map((object) => {
            const points = object.worldPoints.length >= 3
              ? object.worldPoints
              : [
                  { x: object.x - object.width / 2, y: object.y - object.height / 2 },
                  { x: object.x + object.width / 2, y: object.y - object.height / 2 },
                  { x: object.x + object.width / 2, y: object.y + object.height / 2 },
                  { x: object.x - object.width / 2, y: object.y + object.height / 2 },
                ];
            return (
              <polygon
                key={object.id}
                className={`runtime-minimap-object kind-${object.kind}`}
                points={points.map((point) => `${toX(point.x)},${toY(point.y)}`).join(" ")}
                fill={object.color}
              >
                <title>{object.name} · ${Math.round(object.rotation)}°</title>
              </polygon>
            );
          })}
          <rect
            className="runtime-minimap-camera-view"
            x={toX(snapshot.cameraView.left)}
            y={toY(snapshot.cameraView.top)}
            width={toWidth(snapshot.cameraView.width)}
            height={toHeight(snapshot.cameraView.height)}
          />
          <line className="runtime-minimap-crosshair" x1={toX(snapshot.cameraX) - 2} y1={toY(snapshot.cameraY)} x2={toX(snapshot.cameraX) + 2} y2={toY(snapshot.cameraY)} />
          <line className="runtime-minimap-crosshair" x1={toX(snapshot.cameraX)} y1={toY(snapshot.cameraY) - 2} x2={toX(snapshot.cameraX)} y2={toY(snapshot.cameraY) + 2} />
        </svg>
      </div>
      <footer>
        <span>{snapshot.activeCameraName}</span>
        <span>X {Math.round(snapshot.cameraX)} · Y {Math.round(snapshot.cameraY)}</span>
        <span>{Math.round(snapshot.cameraZoom * 100)}%</span>
      </footer>
    </aside>
  );
}

function PackagedGameBar({ projectName }: { projectName: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const windowHandle = getCurrentWindow();
    void windowHandle.isMaximized().then(setMaximized).catch(() => undefined);
  }, []);

  async function closeGame(): Promise<void> {
    try {
      await invoke("close_application");
    } catch {
      await getCurrentWindow().destroy();
    }
  }

  async function toggleMaximize(): Promise<void> {
    const windowHandle = getCurrentWindow();
    await windowHandle.toggleMaximize();
    setMaximized(await windowHandle.isMaximized());
  }

  return (
    <header className="packaged-game-window-bar" data-tauri-drag-region onDoubleClick={() => void toggleMaximize()}>
      <div data-tauri-drag-region><MonitorPlay size={15} /><strong data-tauri-drag-region>{projectName}</strong></div>
      <nav onDoubleClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Minimize game" onClick={() => void getCurrentWindow().minimize()}><Minus size={15} /></button>
        <button type="button" aria-label={maximized ? "Restore game" : "Maximize game"} onClick={() => void toggleMaximize()}>{maximized ? <Copy size={12} /> : <Maximize2 size={13} />}</button>
        <button className="packaged-game-close" type="button" aria-label="Close game" onClick={() => void closeGame()}><X size={16} /></button>
      </nav>
    </header>
  );
}

function RuntimeDiagnosticsOverlay({ snapshot }: { snapshot: RuntimePreviewSnapshot | null }) {
  const [tab, setTab] = useState<"object" | "combat" | "ai" | "abilities" | "scripts" | "profiler">("object");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const selectedObject = snapshot?.objects.find((object) => object.id === selectedObjectId) ?? snapshot?.objects.find((object) => object.kind === "player") ?? snapshot?.objects[0] ?? null;
  const profiler = snapshot?.profiler[snapshot.profiler.length - 1] ?? null;
  return (
    <aside className="runtime-diagnostics-overlay phase8-runtime-debugger">
      <header><Bug size={15} /><strong>Runtime Debugger</strong><span>{snapshot?.bootStage ?? "Booting"}</span></header>
      <nav className="runtime-debug-tabs">
        <button className={tab === "object" ? "active" : ""} type="button" onClick={() => setTab("object")}><Focus size={13} /> Object</button>
        <button className={tab === "combat" ? "active" : ""} type="button" onClick={() => setTab("combat")}><Swords size={13} /> Combat</button>
        <button className={tab === "ai" ? "active" : ""} type="button" onClick={() => setTab("ai")}><Bot size={13} /> AI</button>
        <button className={tab === "abilities" ? "active" : ""} type="button" onClick={() => setTab("abilities")}><WandSparkles size={13} /> Ability</button>
        <button className={tab === "scripts" ? "active" : ""} type="button" onClick={() => setTab("scripts")}><Braces size={13} /> Script</button>
        <button className={tab === "profiler" ? "active" : ""} type="button" onClick={() => setTab("profiler")}><Activity size={13} /> Profiler</button>
      </nav>
      <div className="runtime-diagnostic-summary">
        <span><b>{snapshot?.objectCount ?? 0}</b> objects</span>
        <span><b>{snapshot?.objects.reduce((sum, object) => sum + object.componentCount, 0) ?? 0}</b> Components</span>
        <span><b>{snapshot?.combatLog.length ?? 0}</b> combat</span>
        <span><b>{snapshot?.errors.length ?? 0}</b> errors</span>
      </div>
      {tab === "object" && <div className="runtime-debug-pane">
        <select value={selectedObject?.id ?? ""} onChange={(event) => setSelectedObjectId(event.target.value)}>{snapshot?.objects.map((object) => <option value={object.id} key={object.id}>{object.name}</option>)}</select>
        {selectedObject ? <>
          <div className="runtime-object-stat-grid"><span>Position <b>{Math.round(selectedObject.x)}, {Math.round(selectedObject.y)}</b></span><span>Rotation <b>{Math.round(selectedObject.rotation)}°</b></span><span>Velocity <b>{Math.round(selectedObject.velocityX)}, {Math.round(selectedObject.velocityY)}</b></span><span>Health <b>{selectedObject.health ?? "—"} / {selectedObject.maximumHealth ?? "—"}</b></span><span>Shield <b>{selectedObject.shield} / {selectedObject.maximumShield}</b></span><span>Team <b>{selectedObject.teamId}</b></span><span>AI state <b>{selectedObject.aiState || "—"}</b></span><span>Animation <b>{selectedObject.activeClipId ? `${selectedObject.animationFrame + 1}/${selectedObject.animationFrameCount}` : "—"}</b></span><span>Animation State <b>{selectedObject.animationState || "—"}</b></span><span>Sprite <b className={selectedObject.spriteStatus === "ready" ? "runtime-ok" : "runtime-warning"}>{selectedObject.spriteStatus}</b></span><span>Collider <b>{selectedObject.colliderPoints.length ? `${selectedObject.colliderPoints.length} points` : "shape/none"}</b></span><span>Level <b>{selectedObject.level}</b></span><span>XP <b>{Math.round(selectedObject.experience)}</b></span></div>
          <strong>Resources</strong><code>{JSON.stringify(selectedObject.resources, null, 2)}</code>
          <strong>Statuses</strong><code>{JSON.stringify(selectedObject.statuses, null, 2)}</code>
          <strong>Stats</strong><code>{JSON.stringify(selectedObject.stats, null, 2)}</code>
          <strong>Currencies</strong><code>{JSON.stringify(selectedObject.currencies, null, 2)}</code>
        </> : <div className="runtime-log-empty">No runtime Game Objects exist.</div>}
      </div>}
      {tab === "combat" && <div className="runtime-log-list phase8-trace-list">
        {(snapshot?.combatLog ?? []).slice(-30).reverse().map((entry) => <div key={entry.id} className="runtime-trace-card combat"><strong>{entry.sourceName} → {entry.targetName}</strong><span>{entry.healing ? "Healing" : entry.damageTypeId} · {Math.round(entry.finalAmount)} final</span><small>Base {Math.round(entry.baseAmount)} · Resistance {Math.round(entry.resistance * 100)}% · Shield {Math.round(entry.shieldAbsorbed)}{entry.critical ? " · CRITICAL" : ""}</small></div>)}
        {!snapshot?.combatLog.length && <div className="runtime-log-empty">Combat calculations will appear here.</div>}
      </div>}
      {tab === "ai" && <div className="runtime-log-list phase8-trace-list">
        {(snapshot?.aiTrace ?? []).slice(-30).reverse().map((entry) => <div key={entry.id} className="runtime-trace-card ai"><strong>{entry.objectName}: {entry.previousState || "Start"} → {entry.nextState}</strong><span>{entry.reason}</span><small>Target {entry.targetObjectId ?? "none"} · Distance {Number.isFinite(entry.distance) ? Math.round(entry.distance) : "—"} · LOS {entry.lineOfSight ? "yes" : "no"} · HP {entry.healthPercent.toFixed(1)}%</small></div>)}
        {!snapshot?.aiTrace.length && <div className="runtime-log-empty">AI state transitions will appear here.</div>}
      </div>}
      {tab === "abilities" && <div className="runtime-debug-pane">
        <strong>Cooldowns and resources</strong>
        <code>{JSON.stringify(Object.fromEntries((snapshot?.objects ?? []).filter((object) => Object.keys(object.cooldowns).length || Object.keys(object.resources).length).map((object) => [object.name, { resources: object.resources, cooldowns: object.cooldowns, statuses: object.statuses }])), null, 2)}</code>
      </div>}
      {tab === "scripts" && <div className="runtime-log-list phase8-trace-list">
        {(snapshot?.scriptErrors ?? []).slice(-30).reverse().map((entry) => <div key={entry.id} className="runtime-trace-card error"><strong>{entry.scriptId} · {entry.callback}</strong><span>{entry.message}</span><small>Object {entry.objectId} · line {entry.line}</small></div>)}
        {!snapshot?.scriptErrors.length && <div className="runtime-log-empty">No Shadowium Script errors.</div>}
      </div>}
      {tab === "profiler" && <div className="runtime-debug-pane">
        {profiler ? <><div className="runtime-object-stat-grid profiler"><span>Frame <b>{profiler.frameMs.toFixed(2)} ms</b></span><span>Update <b>{profiler.updateMs.toFixed(2)} ms</b></span><span>Physics <b>{profiler.physicsMs.toFixed(2)} ms</b></span><span>AI <b>{profiler.aiMs.toFixed(2)} ms</b></span><span>Combat <b>{profiler.combatMs.toFixed(2)} ms</b></span><span>Render <b>{profiler.renderMs.toFixed(2)} ms</b></span><span>Game Objects <b>{profiler.activeObjects}</b></span><span>Components <b>{profiler.activeComponents}</b></span><span>Draw calls <b>{profiler.drawCalls}</b></span><span>Particles <b>{profiler.particles}</b></span><span>Audio voices <b>{profiler.audioVoices}</b></span></div><div className="runtime-profiler-bars">{[["Update", profiler.updateMs], ["Physics", profiler.physicsMs], ["AI", profiler.aiMs], ["Combat", profiler.combatMs], ["Render", profiler.renderMs]].map(([label, value]) => <div key={String(label)}><span>{label}</span><i><b style={{ width: `${Math.min(100, Number(value) / Math.max(0.01, profiler.frameMs) * 100)}%` }} /></i><em>{Number(value).toFixed(2)} ms</em></div>)}</div></> : <div className="runtime-log-empty">Profiler data is waiting for the first frame.</div>}
      </div>}
    </aside>
  );
}

export function GamePreview({ packagedPlayer = false, inline = false }: { packagedPlayer?: boolean; inline?: boolean }) {
  const project = useEditorStore((state) => state.project);
  const playState = useEditorStore((state) => state.playState);
  const setPlayState = useEditorStore((state) => state.setPlayState);
  const setStatus = useEditorStore((state) => state.setStatus);
  const [restartToken, setRestartToken] = useState(0);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showColliders, setShowColliders] = useState(false);
  const [snapshot, setSnapshot] = useState<RuntimePreviewSnapshot | null>(null);
  const [session, setSession] = useState(() => playState === "stopped" ? null : createRuntimeSession(project.metadata.id));
  const [sessionSnapshot, setSessionSnapshot] = useState<RuntimeSessionSnapshot | null>(() => session?.snapshot ?? null);
  const [renderRuntime, setRenderRuntime] = useState(() => playState !== "stopped");
  const viewportDisposedResolverRef = useRef<(() => void) | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    function handleSessionState(event: Event): void {
      const detail = (event as CustomEvent<RuntimeSessionSnapshot>).detail;
      if (detail.id !== session?.id) return;
      setSessionSnapshot(detail);
    }
    window.addEventListener(RUNTIME_SESSION_STATE_EVENT, handleSessionState);
    return () => window.removeEventListener(RUNTIME_SESSION_STATE_EVENT, handleSessionState);
  }, [session?.id]);

  useEffect(() => {
    function handleSnapshot(event: Event): void {
      const detail = (event as CustomEvent<RuntimePreviewSnapshot>).detail;
      if (session && detail.sessionId && detail.sessionId !== session.id) return;
      setSnapshot(detail);
    }
    window.addEventListener(RUNTIME_SNAPSHOT_EVENT, handleSnapshot);
    return () => window.removeEventListener(RUNTIME_SNAPSHOT_EVENT, handleSnapshot);
  }, [session]);

  useEffect(() => {
    if (playState === "stopped") {
      if (session && !stoppingRef.current && session.snapshot.state !== "disposed") void stopPreview("Editor requested stop");
      return;
    }
    let active = session;
    if (!active || ["disposed", "crashed"].includes(active.snapshot.state)) {
      active = createRuntimeSession(project.metadata.id);
      setSession(active);
      setSessionSnapshot(active.snapshot);
      setSnapshot(null);
      setRenderRuntime(true);
    }
    if (playState === "paused") active.pause();
    else active.resume();
  }, [playState, project.metadata.id]);

  useEffect(() => {
    async function closePackagedGame(): Promise<void> {
      await disposeActiveRuntimeSession("Packaged game quit");
      try { await invoke("close_application"); }
      catch { await getCurrentWindow().destroy(); }
    }
    function handleRuntimeQuit(): void {
      if (packagedPlayer) void closePackagedGame();
      else void stopPreview("Game requested quit");
    }
    window.addEventListener("shadowium:runtime-quit", handleRuntimeQuit);
    return () => window.removeEventListener("shadowium:runtime-quit", handleRuntimeQuit);
  }, [packagedPlayer, session]);

  useEffect(() => () => {
    viewportDisposedResolverRef.current?.();
    void disposeActiveRuntimeSession("Preview host unmounted");
  }, []);

  async function waitForViewportDisposal(): Promise<void> {
    if (!renderRuntime) return;
    await Promise.race([
      new Promise<void>((resolve) => { viewportDisposedResolverRef.current = resolve; }),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1600)),
    ]);
    viewportDisposedResolverRef.current = null;
  }

  async function waitForEditorViewportEvent(timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let finished = false;
      const complete = (): void => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        window.removeEventListener("shadowium:editor-viewport-restored", complete);
        resolve(true);
      };
      const timeout = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        window.removeEventListener("shadowium:editor-viewport-restored", complete);
        resolve(false);
      }, timeoutMs);
      window.addEventListener("shadowium:editor-viewport-restored", complete, { once: true });
    });
  }

  async function waitForEditorViewportRestore(): Promise<void> {
    if (packagedPlayer) return;
    const firstAttempt = waitForEditorViewportEvent(1000);
    window.dispatchEvent(new Event("shadowium:restore-editor-viewport"));
    if (await firstAttempt) return;

    setStatus("The Scene viewport did not answer the first restore request. Recreating its renderer…", "warning");
    const hardReset = waitForEditorViewportEvent(3000);
    window.dispatchEvent(new Event("shadowium:hard-reset-editor-viewport"));
    if (await hardReset) return;

    setStatus("The Scene viewport could not be restored automatically. Switch to World → Scene to retry.", "error");
  }

  async function stopPreview(reason = "Preview stopped", changeStore = true): Promise<void> {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const active = session ?? getRuntimeSession();
    if (active) setSessionSnapshot({ ...active.snapshot, state: "stopping", reason });
    setRenderRuntime(false);
    await waitForViewportDisposal();
    if (active) await active.dispose(reason);
    // The persistent editor SceneViewport chooses between runtime and editor data from playState.
    // Return the store to Edit Mode before asking it to rebuild, otherwise it can redraw an empty
    // runtime collection and report a successful (but blank) restoration frame.
    setPlayState("stopped");
    setStatus("Restoring the Scene viewport…", "info");
    await waitForEditorViewportRestore();
    setSnapshot(null);
    setSession(null);
    setSessionSnapshot(active?.snapshot ?? null);
    stoppingRef.current = false;
    if (changeStore) setStatus("Play Mode stopped; the editable Scene was restored.", "info");
  }

  async function restart(): Promise<void> {
    await stopPreview("Restarting preview", false);
    const next = createRuntimeSession(project.metadata.id);
    setSession(next);
    setSessionSnapshot(next.snapshot);
    setSnapshot(null);
    setRestartToken((value) => value + 1);
    setRenderRuntime(true);
    setPlayState("playing");
  }

  function resume(): void {
    session?.resume();
    setPlayState("playing");
  }

  function pause(): void {
    session?.pause();
    setPlayState("paused");
  }

  const stopping = sessionSnapshot?.state === "stopping";
  if (playState === "stopped" && !session && !stopping) return null;

  const runtimeViewport = renderRuntime && session ? (
    <SceneViewport
      key={`${session.id}-${restartToken}`}
      runtimeMode
      runtimeSessionId={session.id}
      showRuntimeColliders={showColliders}
      restartToken={restartToken}
      onRuntimeReady={() => setSessionSnapshot(session.snapshot)}
      onRuntimeDisposed={() => viewportDisposedResolverRef.current?.()}
    />
  ) : null;

  if (packagedPlayer) {
    return (
      <main className="packaged-game-runtime" aria-label={`${project.metadata.name} game runtime`}>
        <PackagedGameBar projectName={project.metadata.name} />
        <div className="packaged-game-stage">
          {runtimeViewport}
          {stopping && <div className="runtime-boot-overlay"><Square size={24} /><strong>Closing game…</strong><span>Audio, physics, scripts, assets, and input are being disposed safely.</span></div>}
        </div>
      </main>
    );
  }

  return (
    <div className={`game-preview-screen ${inline ? "inline-preview" : "floating-preview"}`} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-label="Playable game preview">
      <header className="game-preview-header">
        <div className="game-preview-title">
          <span className="game-preview-icon"><MonitorPlay size={18} /></span>
          <div>
            <strong>{inline ? "Play Mode" : "Game Preview"}</strong>
            <small>{project.metadata.name} · {project.settings.gameWidth} × {project.settings.gameHeight} · {sessionSnapshot?.state ?? snapshot?.bootStage ?? "Starting runtime"}</small>
          </div>
        </div>
        <div className="game-preview-controls">
          <button type="button" className={playState === "playing" ? "active" : ""} disabled={stopping} onClick={resume}><Play size={14} /> Resume</button>
          <button type="button" className={playState === "paused" ? "active" : ""} disabled={stopping} onClick={pause}><Pause size={14} /> Pause</button>
          <button type="button" title="Advance exactly one frame while paused" disabled={playState !== "paused" || stopping} onClick={() => window.dispatchEvent(new Event(RUNTIME_STEP_EVENT))}><SkipForward size={14} /> Step</button>
          <button type="button" disabled={stopping} onClick={() => void restart()}><RotateCcw size={14} /> Restart</button>
          <button type="button" className={showMinimap ? "active" : ""} title="Toggle camera preview minimap" onClick={() => setShowMinimap((value) => !value)}><Map size={14} /> Camera</button>
          <button type="button" className={showColliders ? "active" : ""} title="Toggle collider and solid-tile overlays" onClick={() => setShowColliders((value) => !value)}><ScanLine size={14} /> Colliders</button>
          <button type="button" className={showDiagnostics ? "active" : ""} title="Toggle runtime diagnostics" onClick={() => setShowDiagnostics((value) => !value)}><Bug size={14} /> Debug</button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14} /> Fullscreen</button>
          <button className="stop-preview" type="button" disabled={stopping} onClick={() => void stopPreview()}><Square size={13} /> {stopping ? "Stopping…" : "Stop"}</button>
          <button className="icon-button" type="button" title="Close preview" disabled={stopping} onClick={() => void stopPreview()}><X size={18} /></button>
        </div>
      </header>

      <main className="game-preview-stage">
        <div className="game-preview-frame" style={{ aspectRatio: `${project.settings.gameWidth} / ${project.settings.gameHeight}` }}>
          {runtimeViewport}
          {showMinimap && !stopping && <CameraPreviewMinimap snapshot={snapshot} />}
          {showDiagnostics && !stopping && <RuntimeDiagnosticsOverlay snapshot={snapshot} />}
          {playState === "paused" && !stopping && <div className="game-preview-paused"><Pause size={32} /><strong>Paused</strong><small>Use Step to advance one frame.</small></div>}
          {!snapshot && !stopping && <div className="runtime-boot-overlay"><Focus size={24} /><strong>Creating isolated runtime session…</strong><span>Components, physics, scripts, AI, abilities, audio, and UI are being instantiated.</span></div>}
          {stopping && <div className="runtime-boot-overlay stopping"><Square size={24} /><strong>Stopping game safely…</strong><span>Cancelling asynchronous work and disposing the runtime before returning to the workbench.</span></div>}
        </div>
      </main>

      <footer className="game-preview-footer">
        <span>Session {session?.generation ?? "—"}</span>
        <span>WASD / Arrow Keys to move</span>
        <span>E to interact</span>
        <span>Camera: {snapshot?.activeCameraName ?? "initialising"}</span>
        <span>FOV: {snapshot ? `${Math.round(snapshot.cameraFov)}°` : "—"}</span>
        <span>Runtime state is isolated from the editor</span>
      </footer>
    </div>
  );
}
