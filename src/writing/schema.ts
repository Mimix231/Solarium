import { getSchema, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MarkdownManager } from '@tiptap/markdown';
import { validateBody } from '../foundation/types';
import type { WritingContent } from './types';

export const writingExtensions = [StarterKit.configure({link:{openOnClick:false,protocols:['https','mailto']}})];
const schema = getSchema(writingExtensions);
const markdown = new MarkdownManager({ extensions:writingExtensions });
/** Raw HTML is plain text. No web images, scripts or remote embeds can enter the authoring surface. */
export function markdownContent(text:string):WritingContent {
  validateBody(text);
  const structuredJson=markdown.parse(text.replace(/<(?=\/?[A-Za-z!])/g,'&lt;'));
  if(!structuredJson.content?.length)structuredJson.content=[{type:'paragraph'}];
  validateStructured(structuredJson);
  return {schemaVersion:1,structuredJson,markdownProjection:text};
}
export function validateStructured(json:unknown):asserts json is JSONContent {
  if(!json||typeof json!=='object'||(json as JSONContent).type!=='doc') throw Error('Unsupported rich document schema. Export the original Markdown for recovery.');
  const node=schema.nodeFromJSON(json);node.check();
  node.descendants(n=>{for(const mark of n.marks) if(mark.type.name==='link' && !/^(?:https:\/\/|mailto:|#)/i.test(String(mark.attrs.href))) throw Error('Unsupported document link.');});
}
export function structuredContent(json:JSONContent):WritingContent {validateStructured(json);return {schemaVersion:1,structuredJson:json,markdownProjection:markdown.serialize(json)};}
export function readWritingContent(body:string):WritingContent {
  const content=JSON.parse(body) as WritingContent;
  if(content.schemaVersion!==1) throw Error('This document schema is newer than Solarium supports.');
  validateBody(content.markdownProjection);validateStructured(content.structuredJson);return content;
}

/** Exact rendered words survive formatting-only edits; changed events do not. */
export function containsWritingPassage(content:WritingContent,quote:string):boolean {
  const plain=(value:WritingContent)=>schema.nodeFromJSON(value.structuredJson).textBetween(0,schema.nodeFromJSON(value.structuredJson).content.size,'\n').replace(/\s+/g,' ').trim();
  const passage=plain(markdownContent(quote));return passage.length>=8&&(content.markdownProjection.includes(quote)||plain(content).includes(passage));
}
