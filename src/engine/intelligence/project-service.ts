/** Same native Glitch service used by the code editor; no second inference client. */
export async function projectService<T=unknown>(root:string,method:string,params:Record<string,unknown>={}):Promise<T>{
  if(typeof window==='undefined'||!('__TAURI_INTERNALS__' in window))throw Error('Indexed project intelligence requires Solarium Desktop.');
  const {invoke}=await import('@tauri-apps/api/core');return invoke<T>('glitch_project_request',{root,method,params});
}
