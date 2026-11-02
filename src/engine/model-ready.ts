import type { LocalModel, Preferences } from '../domain/types';
import {invoke} from '@tauri-apps/api/core';
import { activateGGUFModel } from './desktop';
/** One readiness path shared by chat and in-app quality tasks; reuses the managed server. */
export async function readyModel(model: LocalModel, preferences: Preferences): Promise<{model:LocalModel;detail:string}> {
  if (!model.ggufPath) return {model,detail:'Connected model'};
  if (!preferences.llamaExecutable) throw Error('Install llama.cpp first in Models → Inference Engines.');
  const plan=model.runtime?.mode==='manual'?null:await invoke<{recommendedGpuLayers:number}>('model_load_plan',{gguf:model.ggufPath,context:model.contextSize});
  const result = await activateGGUFModel({executable:preferences.llamaExecutable,gguf:model.ggufPath,port:preferences.serverPort,context:model.contextSize,gpuLayers:plan?.recommendedGpuLayers??model.runtime?.gpuLayers??0});
  return {model:{...model,endpoint:`http://127.0.0.1:${preferences.serverPort}`,modelId:result.modelId},detail:result.detail};
}
