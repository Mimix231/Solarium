/** Conservative profiles for a single 12 GB NVIDIA GPU when two independent engines are started. */
export type OptimizationPreset = 'balanced' | 'llama-performance' | 'memory-saver';
export interface OptimizationSettings { gpuLayers: number; vllmFraction: number; context: number; description: string }
export const optimizationPresets: Record<OptimizationPreset, OptimizationSettings> = {
  balanced: { gpuLayers: 20, vllmFraction: .35, context: 4096, description: 'Partial GGUF offload and a small vLLM GPU budget. Best starting point when both engines run.' },
  'llama-performance': { gpuLayers: -1, vllmFraction: .25, context: 4096, description: 'Maximize llama.cpp offload. Start vLLM only if enough VRAM remains.' },
  'memory-saver': { gpuLayers: 0, vllmFraction: .3, context: 2048, description: 'Run llama.cpp on CPU and reserve limited GPU space for vLLM. Slower llama.cpp inference.' },
};
