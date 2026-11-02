import { useDocumentStore } from "../stores/documentStore";
import { useSettingsStore } from "../stores/settingsStore";

let started=false;
let subscriptions:(()=>void)[]=[];
const timers=new Map<string,number>();
const pendingContent=new Map<string,string>();

function clear(path:string){const timer=timers.get(path);if(timer!==undefined)window.clearTimeout(timer);timers.delete(path);pendingContent.delete(path);}
function reconcile(){
  const settings=useSettingsStore.getState().settings;
  const docs=useDocumentStore.getState().documents;
  const live=new Set(docs.map(d=>d.path));
  for(const path of [...timers.keys()])if(!live.has(path)||settings.editorAutoSave==="off"&&!docs.find(d=>d.path===path)?.generated)clear(path);

  for(const doc of docs){
    if(!doc.generated&&settings.editorAutoSave!=="afterDelay")continue;
    if(doc.content===doc.savedContent){clear(doc.path);continue;}
    if(timers.has(doc.path)&&pendingContent.get(doc.path)===doc.content)continue;
    clear(doc.path);pendingContent.set(doc.path,doc.content);
    timers.set(doc.path,window.setTimeout(()=>{
      timers.delete(doc.path);pendingContent.delete(doc.path);
      const current=useDocumentStore.getState().documents.find(d=>d.path===doc.path);
      if(current&&current.content!==current.savedContent)void useDocumentStore.getState().save(doc.path).catch(error=>{void import('../stores/workspaceStore').then(({useWorkspaceStore})=>useWorkspaceStore.setState({error:'Auto Save: '+String(error)}));});
    },Math.max(250,settings.editorAutoSaveDelayMs)));
  }
}
export const autoSaveService={
  start(){if(started)return;started=true;subscriptions=[useDocumentStore.subscribe((state,previous)=>{if(state.documents!==previous.documents)reconcile();}),useSettingsStore.subscribe(reconcile)];reconcile();},
  stop(){for(const unsubscribe of subscriptions)unsubscribe();subscriptions=[];for(const path of [...timers.keys()])clear(path);started=false;},
};
