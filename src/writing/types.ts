import type { LibraryScope, StoredRecord } from '../foundation/types';
export const writingKinds = ['chapter','scene','short_story','outline','screenplay','dialogue','article','essay','report','note','lore_document','other'] as const;
export type WritingKind = typeof writingKinds[number];
export interface WritingData {
  schemaVersion: 1; kind: WritingKind; categoryId: string | null; currentRevisionId: string;
  status: 'generating'|'draft'|'review'|'final'|'archived'; tags: string[];
  originConversationId: string | null; originMessageId: string | null; legacyBlockId?: string;
  createdAt: string; wordCount: number; sourceIds: string[]; characterIds: string[];
  metadata: {chapterNumber?:number;sceneOrder?:number;povCharacterId?:string;tense?:string;language?:string;targetWordCount?:number};
}
export type WritingDocument = StoredRecord<WritingData>;
export interface WritingRevisionData {documentId:string;parentRevisionId:string|null;schemaVersion:1;isPartialDraft:boolean;reason:'generated'|'user_edit'|'spark_revision'|'import';createdAt:string}
export type WritingRevision = StoredRecord<WritingRevisionData>;
export interface WritingContent { schemaVersion:1; structuredJson:import('@tiptap/core').JSONContent; markdownProjection:string }
export interface CategoryData { parentId:string|null; sortOrder:number; archived:boolean }
export type WritingCategory = StoredRecord<CategoryData>;
export interface WritingSelection { documentId:string; revisionId:string; from:number; to:number; text:string }
export interface WritingDraft { documentId:string; markdown:string; baseRevisionId:string; owner:LibraryScope; status:'generating'|'cancelled'|'draft'; updatedAt:string }
