import { createId } from "./ids";

export type RuntimeSessionState = "idle" | "starting" | "running" | "paused" | "stopping" | "disposed" | "crashed";
export const RUNTIME_SESSION_STATE_EVENT = "shadowium-runtime-session-state";

export interface RuntimeSessionSnapshot {
  id: string;
  generation: number;
  projectId: string;
  state: RuntimeSessionState;
  startedAt: number;
  stoppedAt: number | null;
  reason: string;
  error: string;
}

type Cleanup = () => void | Promise<void>;

class RuntimeSession {
  readonly id = createId("runtime-session");
  readonly generation: number;
  readonly projectId: string;
  readonly startedAt = performance.now();
  readonly abortController = new AbortController();
  private cleanups = new Set<Cleanup>();
  private snapshotValue: RuntimeSessionSnapshot;

  constructor(projectId: string, generation: number) {
    this.projectId = projectId;
    this.generation = generation;
    this.snapshotValue = { id: this.id, generation, projectId, state: "starting", startedAt: this.startedAt, stoppedAt: null, reason: "", error: "" };
    this.emit();
  }

  get snapshot(): RuntimeSessionSnapshot { return { ...this.snapshotValue }; }
  get signal(): AbortSignal { return this.abortController.signal; }
  get active(): boolean { return !["stopping", "disposed", "crashed"].includes(this.snapshotValue.state); }

  registerCleanup(cleanup: Cleanup): () => void {
    this.cleanups.add(cleanup);
    return () => this.cleanups.delete(cleanup);
  }

  markRunning(): void {
    if (this.snapshotValue.state === "starting" || this.snapshotValue.state === "paused") this.transition("running");
  }

  pause(): void {
    if (this.snapshotValue.state === "running") this.transition("paused");
  }

  resume(): void {
    if (this.snapshotValue.state === "paused" || this.snapshotValue.state === "starting") this.transition("running");
  }

  crash(error: unknown): void {
    this.snapshotValue.error = error instanceof Error ? error.message : String(error);
    this.snapshotValue.reason = "Runtime crashed";
    this.snapshotValue.stoppedAt = performance.now();
    this.transition("crashed");
    this.abortController.abort(this.snapshotValue.error);
  }

  async dispose(reason = "Preview stopped"): Promise<void> {
    if (this.snapshotValue.state === "disposed") return;
    if (this.snapshotValue.state === "stopping") {
      await this.waitForState("disposed", 4000);
      return;
    }
    this.snapshotValue.reason = reason;
    this.transition("stopping");
    this.abortController.abort(reason);
    const cleanups = [...this.cleanups].reverse();
    this.cleanups.clear();
    for (const cleanup of cleanups) {
      try {
        await Promise.race([
          Promise.resolve(cleanup()),
          new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
        ]);
      } catch {
        // Teardown must continue even when one subsystem has already disposed itself.
      }
    }
    this.snapshotValue.stoppedAt = performance.now();
    this.transition("disposed");
  }

  waitForState(state: RuntimeSessionState, timeoutMs = 4000): Promise<void> {
    if (this.snapshotValue.state === state) return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => { window.removeEventListener(RUNTIME_SESSION_STATE_EVENT, listener); resolve(); }, timeoutMs);
      const listener = (event: Event): void => {
        const detail = (event as CustomEvent<RuntimeSessionSnapshot>).detail;
        if (detail.id !== this.id || detail.state !== state) return;
        window.clearTimeout(timeout);
        window.removeEventListener(RUNTIME_SESSION_STATE_EVENT, listener);
        resolve();
      };
      window.addEventListener(RUNTIME_SESSION_STATE_EVENT, listener);
    });
  }

  private transition(state: RuntimeSessionState): void {
    this.snapshotValue.state = state;
    this.emit();
  }

  private emit(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<RuntimeSessionSnapshot>(RUNTIME_SESSION_STATE_EVENT, { detail: this.snapshot }));
  }
}

let generation = 0;
let activeSession: RuntimeSession | null = null;

export function createRuntimeSession(projectId: string): RuntimeSession {
  if (activeSession?.active) void activeSession.dispose("Replaced by a newer runtime session");
  generation += 1;
  activeSession = new RuntimeSession(projectId, generation);
  return activeSession;
}

export function getRuntimeSession(id?: string | null): RuntimeSession | null {
  if (!activeSession) return null;
  if (id && activeSession.id !== id) return null;
  return activeSession;
}

export function isRuntimeSessionCurrent(id: string): boolean {
  return activeSession?.id === id && activeSession.active && !activeSession.signal.aborted;
}

export async function disposeActiveRuntimeSession(reason?: string): Promise<void> {
  const session = activeSession;
  if (!session) return;
  await session.dispose(reason);
  if (activeSession === session) activeSession = null;
}
