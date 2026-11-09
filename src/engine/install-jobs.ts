import { create } from 'zustand';
import { useSolarium } from '../state/useSolarium';
export type InstallStatus = 'running' | 'cancelling' | 'cancelled' | 'interrupted' | 'completed' | 'failed';
export interface InstallJob {
  id: string; engine: 'llama.cpp' | 'vllm' | 'coding-tools' | 'gguf'; status: InstallStatus; phase: string;
  downloaded: number; total: number; updatedAt: number; result: string | null; error: string | null;
}
const native = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const invoke = async <T>(command: string, args?: Record<string, unknown>) => {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
};
interface InstallerState {
  jobs: InstallJob[]; initialized: boolean; error: string | null;
  refresh: () => Promise<void>;
  start: (engine: InstallJob['engine'], args?: { cuda?: boolean }) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}
export const useInstallJobs = create<InstallerState>((set, get) => ({
  jobs: [], initialized: false, error: null,
  refresh: async () => {
    if (!native()) { set({ initialized: true }); return; }
    try {
      const jobs = await invoke<InstallJob[]>('get_install_jobs');
      set({ jobs, initialized: true, error: null });
      const path = [...jobs].reverse().find((j) => j.engine === 'llama.cpp' && j.status === 'completed' && j.result)?.result;
      if (path && path !== useSolarium.getState().workspace.preferences.llamaExecutable) {
        useSolarium.getState().updatePreferences({ llamaExecutable: path });
      }
    }
    catch (error) { set({ error: String(error), initialized: true }); }
  },
  cancel: async (id) => {
    try { await invoke<void>('cancel_install_job', { id }); await get().refresh(); }
    catch (error) { set({ error: String(error) }); throw error; }
  },
  start: async (engine, args = {}) => {
    try {
      await invoke<string>('start_install_job', { engine, ...args });
      await get().refresh();
    } catch (error) { set({ error: String(error) }); throw error; }
  },
}));
let stop: (() => void) | undefined;
/** Subscribe once at app startup, not from any particular screen. */
export function startInstallerTracking(): () => void {
  if (stop) return stop;
  void useInstallJobs.getState().refresh();
  const poll = setInterval(() => { void useInstallJobs.getState().refresh(); }, 2000);
  let disposed = false;
  let unlisten: (() => void) | undefined;
  if (native()) {
    void import('@tauri-apps/api/event').then(({ listen }) => listen<InstallJob>('solarium-install-job', (event) => {
      useInstallJobs.setState((state) => ({ jobs: [...state.jobs.filter((job) => job.id !== event.payload.id), event.payload] }));
      if (event.payload.engine === 'llama.cpp' && event.payload.status === 'completed' && event.payload.result) useSolarium.getState().updatePreferences({ llamaExecutable: event.payload.result });
    })).then((fn) => { if (disposed) fn(); else unlisten = fn; }).catch(() => {});
  }
  stop = () => { disposed = true; clearInterval(poll); unlisten?.(); stop = undefined; };
  return stop;
}
export function installProgress(job: InstallJob): number | null {
  return job.total > 0 ? Math.max(0, Math.min(100, 100 * job.downloaded / job.total)) : null;
}
