import { partialJsonString } from '../engine/live-workspace';
import { profileFields, type ProfileField, type ProfileText } from './fiction';

export interface FictionProfilePreview {
  name: string;
  sections: ProfileText;
}

export interface FictionProfileProgress {
  profiles: FictionProfilePreview[];
  phase: 'streaming' | 'saving' | 'saved' | 'failed';
  point?: string;
}

export interface DraftedFictionProfile extends FictionProfilePreview {
  evidence: {field:ProfileField;source_id:string;quote:string}[];
}

/** Parse readable streamed headings before validating the finished save payload. */
export function readFictionDossier(prose:string,names:readonly string[]):DraftedFictionProfile[] {
  const profiles:DraftedFictionProfile[]=[];
  const select=(name:string)=>profiles.find(profile=>profile.name===name)??{
    name,sections:{},evidence:[],
  };
  let current=names.length===1?select(names[0]!):undefined;
  if(current)profiles.push(current);
  let field:ProfileField|undefined;
  for(const rawLine of prose.split(/\r?\n/)){
    const line=rawLine.trim();
    const heading=/^#{1,2}\s+(?:Profile\s*:\s*)?(.+)$/i.exec(line);
    const title=heading?.[1]?.replace(/\*\*/g,'').trim();
    const name=title&&names.find(candidate=>candidate.localeCompare(title,undefined,{sensitivity:'accent'})===0);
    if(name){
      current=select(name);
      if(!profiles.includes(current))profiles.push(current);
      field=undefined;
      continue;
    }
    if(!current)continue;
    if(/^World rule\s*:/i.test(line)){field=undefined;continue;}
    const label=/^(?:#{2,4}\s+|\*\*)?([\p{L}]+)\s*(?:\*\*)?\s*:?[ \t]*(.*)$/u.exec(line);
    const labelField=label?.[1]?.toLowerCase() as ProfileField|undefined;
    if(labelField&&profileFields.includes(labelField)&&(/^#{2,4}\s/.test(line)||line.includes(':')||line===label?.[1])){
      field=labelField;
      current.sections[field]=label?.[2]?.replace(/^\*\*\s*/, '').trim()??'';
      continue;
    }
    const evidence=/^Evidence\s*:\s*([a-z]+)\s*\|\s*([^|]+)\|\s*(.+)$/i.exec(line);
    if(evidence&&profileFields.includes(evidence[1]!.toLowerCase() as ProfileField)){
      current.evidence.push({field:evidence[1]!.toLowerCase() as ProfileField,source_id:evidence[2]!.trim(),
        quote:evidence[3]!.trim().replace(/^"|"$/g,'')});
      continue;
    }
    if(field){
      const previous=current.sections[field]??'';
      current.sections[field]=(previous+(previous?'\n':'')+line).slice(0,1600);
    }
  }
  for(const profile of profiles){
    for(const field of profileFields){
      const text=profile.sections[field]?.trim();
      if(text)profile.sections[field]=text;
      else delete profile.sections[field];
    }
  }
  return profiles.filter(profile=>Object.keys(profile.sections).length>0);
}

/** Display real fields from an unfinished tool argument. Validation owns all writes. */
export function streamedFictionProfiles(argumentsSoFar: string): FictionProfilePreview[] {
  const source = argumentsSoFar.slice(0, 65_536);
  const key = /(?<!\\)"profiles"\s*:\s*\[/g;
  if (!key.exec(source)) return [];
  const profiles: FictionProfilePreview[] = [];
  let depth = 0;
  let sections = false;
  let profile: FictionProfilePreview | undefined;
  for (let i = key.lastIndex; i < source.length; i++) {
    const char = source[i];
    if (char === ']' && depth === 0) break;
    if (char === '{') {
      depth++;
      if (depth === 1) {
        if (profiles.length === 12) break;
        profile = { name:'', sections:{} };
        profiles.push(profile);
      }
    } else if (char === '}') {
      if (depth === 2) sections = false;
      depth--;
    } else if (char === '"' && profile) {
      const token = partialJsonString(source,i+1);
      i=token.end-1;
      if (!token.complete) break;
      const separator=/^\s*:\s*/.exec(source.slice(token.end));
      if (!separator) continue;
      const start=token.end+separator[0].length;
      if (token.value==='sections' && depth===1 && source[start]==='{') sections=true;
      if (source[start]!=='"') continue;
      const value=partialJsonString(source,start+1);
      i=value.end-1;
      if (token.value==='name' && depth===1) profile.name=value.value.slice(0,120);
      if (sections && depth===2 && profileFields.includes(token.value as ProfileField)) {
        profile.sections[token.value as ProfileField]=value.value.slice(0,1600);
      }
      if (!value.complete) break;
    }
  }
  return profiles.filter(profile=>profile.name.trim());
}
