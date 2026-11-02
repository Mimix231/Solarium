import { create } from "zustand";
import { api } from "../integration/api";
import type { TerminalDescriptor } from "../lib/types";
interface State { terminals:TerminalDescriptor[];activeId:string;create(cwd:string,title?:string,command?:string):Promise<TerminalDescriptor>;close(id:string):Promise<void>;setActive(id:string):void; }
export const useTerminalStore=create<State>((set,get)=>({
  terminals:[],activeId:"",
  create:async(cwd,title,command)=>{const d=await api.createTerminal(cwd,title);set(s=>({terminals:[...s.terminals,d],activeId:d.id}));if(command){await api.writeTerminal(d.id,command+"\r",d.root);}return d;},
  close:async id=>{await api.killTerminal(id,get().terminals.find(t=>t.id===id)?.root);const left=get().terminals.filter(t=>t.id!==id);set({terminals:left,activeId:get().activeId===id?(left.at(-1)?.id??""):get().activeId});},
  setActive:activeId=>set({activeId}),
}));
