/** Local compile fixture only: Vite's import.meta.glob contract. Do not ship as runtime code. */
interface ImportMeta {
  glob<T=unknown>(pattern: string, options?: {query?:string;import?:string}): Record<string,()=>Promise<T>>;
}
