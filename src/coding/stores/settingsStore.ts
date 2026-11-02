import { create } from 'zustand';
import type { CodeWorkspaceSettings } from '../lib/types';
import { api } from '../integration/api';
import { normalizeSettings } from '../settings/registry';
export const DEFAULT_SETTINGS=normalizeSettings({});
interface State{settings:CodeWorkspaceSettings;loaded:boolean;load():Promise<void>;save(next:CodeWorkspaceSettings):Promise<void>}
export const useSettingsStore=create<State>(set=>({settings:DEFAULT_SETTINGS,loaded:false,load:async()=>{try{set({settings:normalizeSettings({...DEFAULT_SETTINGS,...await api.loadSettings()}),loaded:true});}catch(error){set({loaded:true});void import('./workspaceStore').then(({useWorkspaceStore})=>useWorkspaceStore.setState({error:'Editor settings: '+String(error)}));}},save:async next=>set({settings:normalizeSettings(await api.saveSettings(normalizeSettings(next)))})}));
