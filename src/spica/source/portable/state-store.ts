/** Portable adaptation of SPICA's session-scoped state_value / state_update.
 * No global state, storage bridge or permission grants are inherited. */
export interface TextStateStore { get(key: string): string | undefined; set(key: string,value: string): void; subscribe(listener: (key: string,value: string)=>void): ()=>void }
export function createTextStateStore(initial: Readonly<Record<string, string>> = {}): TextStateStore {
  const values = new Map<string,string>(Object.entries(initial));
  const listeners = new Set<(key:string,value:string)=>void>();
  return {
    get(key) { return values.get(key); },
    set(key,value) { if (!key || ['__proto__','constructor','prototype'].includes(key)) throw Error('Unsafe state key'); values.set(key,value); for (const listener of listeners) listener(key,value); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
