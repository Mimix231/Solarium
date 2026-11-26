import type { ConstructionSession } from './session';

/** Reuse the task_execution CAS record, not a parallel record store. */
export interface ConstructionCheckpointOwner {
  setConstructionCheckpoint(checkpoint: ConstructionSession): void;
  persist(): Promise<void>;
}

/** A committed event is exposed to listeners only AFTER the task record saves. */
export class ConstructionCheckpointStore {
  constructor(private readonly task: ConstructionCheckpointOwner) {}
  async save(checkpoint: ConstructionSession): Promise<void> {
    this.task.setConstructionCheckpoint(checkpoint);
    await this.task.persist();
  }
}
