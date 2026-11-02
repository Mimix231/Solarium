import type { ContentBlock } from '../../blocks/protocol';
import type { CodeBlockContext } from './context';
import { CodeRepository } from './repository';

export async function openGeneratedCode(block:ContentBlock,context:CodeBlockContext){
  if(context.streaming)throw Error('Wait for generation or Stop before opening this source for editing.');
  if(!context.access.sessionId)throw Error('Open the originating conversation first.');
  const repo=new CodeRepository(context.access);
  const id=`code:${context.access.sessionId}:${context.messageId}:${block.id}`;
  const artifact=(await repo.list()).find(item=>item.id===id)??await repo.capture(block,{sessionId:context.access.sessionId,messageId:context.messageId,blockId:block.id,sparkId:context.sparkId},context.naturalEnd===true,false,true);
  if(artifact.data.state==='streaming')await repo.recoverInterrupted(artifact.id,artifact.version);
  const {useSolarium}=await import('../../state/useSolarium');
  const {useDocumentStore}=await import('../stores/documentStore');
  const {useWorkbenchStore}=await import('../stores/workbenchStore');
  useSolarium.getState().mutate(w=>{w.activeProjectId=context.access.projectId??null;w.activeSessionId=context.access.sessionId;});
  await useDocumentStore.getState().openGenerated(artifact.id,context.access);
  useWorkbenchStore.getState().setSidebarView('generated');
  useSolarium.getState().setView('code');
}
