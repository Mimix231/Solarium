import type { StoredRecord } from '../foundation/types';
type Archive={schemaVersion:1;records:{record:StoredRecord;body:string|null}[]};
/** A portable category needs its hierarchy, revisions and referenced evidence,
 * not just the visible document rows. Unrelated documents stay out. */
export function categoryArchive(archive:Archive,categoryId:string):Archive{
  const byId=new Map(archive.records.map(e=>[e.record.id,e]));const categories=new Set([categoryId]);let changed=true;
  while(changed){changed=false;for(const {record:r}of archive.records){const d=r.data as Record<string,unknown>;if(r.collection==='writing_category'&&categories.has(String(d.parentId))&&!categories.has(r.id)){categories.add(r.id);changed=true;}}}
  const included=new Set<string>();for(const {record:r}of archive.records){const d=r.data as Record<string,unknown>;if(r.collection==='writing_category'&&categories.has(r.id)||r.collection==='writing_document'&&(categoryId==='none'?!d.categoryId:categories.has(String(d.categoryId))))included.add(r.id);}
  const references=(value:unknown):string[]=>typeof value==='string'?(byId.has(value)?[value]:[]):Array.isArray(value)?value.flatMap(references):value&&typeof value==='object'?Object.values(value).flatMap(references):[];
  changed=true;while(changed){changed=false;for(const {record:r}of archive.records){const d=r.data as Record<string,unknown>;
    if(included.has(r.id)){for(const id of [r.storyId,...references(r.data)])if(id&&byId.has(id)&&!included.has(id)){included.add(id);changed=true;}}
    else if(['writing_revision','writing_draft','writing_task'].includes(r.collection)&&included.has(String(d.documentId))||r.collection==='source_chunk'&&included.has(String(d.sourceId))||['story_character','character_claim','character_claim_revision','story_event','story_relation'].includes(r.collection)&&r.storyId&&included.has(r.storyId)){included.add(r.id);changed=true;}
  }}
  return{schemaVersion:1,records:archive.records.filter(e=>included.has(e.record.id))};
}
