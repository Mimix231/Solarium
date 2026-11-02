export interface CloseActions {stopWork:()=>Promise<void>;saveFiles:()=>Promise<void>;saveRecovery:()=>Promise<void>;saveWorkspace:()=>Promise<void>;destroy:()=>Promise<void>}
/** A failed flush never becomes an exit. All paths retain the same recovery contract. */
export class CloseCoordinator {
  private pending:Promise<void>|null=null;
  constructor(private actions:CloseActions){}
  close(save:boolean):Promise<void>{
    if(this.pending)return this.pending;
    const task=(async()=>{await this.actions.stopWork();if(save)await this.actions.saveFiles();await this.actions.saveRecovery();await this.actions.saveWorkspace();await this.actions.destroy();})();
    this.pending=task;void task.finally(()=>{if(this.pending===task)this.pending=null;}).catch(()=>{});return task;
  }
}
