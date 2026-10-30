import { useSolarium } from '../state/useSolarium';
import { useShallow } from 'zustand/react/shallow';
import { useMemo } from 'react';
export function useLibraryContext(){
  const {session,project}=useSolarium(useShallow(s=>{
    const session=s.workspace.sessions.find(c=>c.id===s.workspace.activeSessionId);
    const project=(s.workspace.projects??[]).find(p=>p.id===(session?.projectId??s.workspace.activeProjectId));return {session,project};
  }));
  const access=useMemo(()=>({sessionId:session?.id??null,projectId:project?.id??null}),[session?.id,project?.id]);
  return {session,project,access,scope:project?{kind:'project' as const,id:project.id}:session?{kind:'chat' as const,id:session.id}:{kind:'library' as const,id:'personal' as const}};
}
