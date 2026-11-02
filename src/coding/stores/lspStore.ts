import { create } from "zustand";
import { api } from "../integration/api";
import type { LspStatus } from "../lib/types";

interface State {
  status?: LspStatus;
  loading:boolean;
  error?:string;
  refresh():Promise<void>;
}

export const useLspStore=create<State>(set=>({
  loading:false,
  refresh:async()=>{
    set({loading:true,error:undefined,status:undefined});
    try{set({status:await api.lspStatus(),loading:false});}
    catch(error){set({loading:false,error:String(error)});}
  },
}));
