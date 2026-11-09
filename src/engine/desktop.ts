const isDesktop = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export async function chooseFile(filters: { name: string; extensions: string[] }[] = []): Promise<string | null> {
  if (!isDesktop()) throw new Error('Native file browsing is available in the desktop app only.');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ multiple: false, directory: false, ...(filters.length ? { filters } : {}) });
  return typeof result === 'string' ? result : null;
}
export async function startLlamaServer(executable: string, gguf: string, port: number, context: number, gpuLayers = -1): Promise<string> {
  (await import('./work-lifecycle')).workLifecycle.assertIdle();
  if (!isDesktop()) throw new Error('Start/stop commands require the desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('start_llama_server', { executable, gguf, port, context, gpuLayers });
}
export async function stopLlamaServer(): Promise<string> {
  (await import('./work-lifecycle')).workLifecycle.assertIdle();
  if (!isDesktop()) throw new Error('Start/stop commands require the desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('stop_llama_server');
}

export async function startVllmServer(model: string, port: number, context: number, gpuMemoryUtilization: number): Promise<string> {
  (await import('./work-lifecycle')).workLifecycle.assertIdle();
  if (!isDesktop()) throw new Error('WSL2 server launch requires the Windows desktop application.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('start_vllm_server', { model, port, context, gpuMemoryUtilization });
}
export async function stopVllmServer(): Promise<string> {
  (await import('./work-lifecycle')).workLifecycle.assertIdle();
  if (!isDesktop()) throw new Error('WSL2 server control requires the Windows desktop application.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('stop_vllm_server');
}
export async function gpuStatus(): Promise<string> {
  if (!isDesktop()) throw new Error('GPU inspection requires the desktop application.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('nvidia_gpu_status');
}

export async function readEngineLog(engine: 'llama.cpp' | 'vllm'): Promise<string> {
  if (!isDesktop()) throw new Error('Engine logs require the desktop application.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('read_engine_log', { engine });
}

/** The native runtime folder, not Windows AppData. Anchored to the app, not CWD. */
export async function getRuntimeLocation(): Promise<string> {
  if (!isDesktop()) throw new Error('Runtime location is available in Solarium Desktop.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('get_runtime_location');
}

export interface GGUFFile { name: string; path: string; sizeBytes: number }
export async function chooseDirectory(): Promise<string | null> {
  if (!isDesktop()) throw new Error('Choose a GGUF folder in Solarium Desktop.');
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ directory: true, multiple: false });
  return typeof result === 'string' ? result : null;
}
export async function scanGGUFDirectory(directory: string): Promise<GGUFFile[]> {
  if (!isDesktop()) throw new Error('GGUF folder scanning is available only in Solarium Desktop.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<GGUFFile[]>('scan_gguf_directory', { directory });
}

export async function activateGGUFModel(options: { executable: string; gguf: string; port: number; context: number; gpuLayers?: number }): Promise<{modelId: string; detail: string}> {
  if (!isDesktop()) throw new Error('Load a GGUF through the desktop application.');
  const { invoke } = await import('@tauri-apps/api/core');
  const {workLifecycle}=await import('./work-lifecycle');workLifecycle.assertIdle();
  return invoke<{modelId: string; detail: string}>('activate_gguf_model',options);
}
