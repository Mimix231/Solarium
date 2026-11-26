import type { ProfileField, ProfileText } from '../stories/fiction';
import { scenePassages, type SceneCorrection } from './acceptance';

export interface ChapterCastProfile {
  name:string;
  aliases:readonly string[];
  fields:ProfileText;
}

const fields:ProfileField[]=['appearance','relationships','history','personality','voice','abilities','knowledge','constraints'];
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const actor=(profile:ChapterCastProfile)=>[profile.name,...profile.aliases]
  .sort((a,b)=>b.length-a.length).map(escape).join('|');
const actorMatches=(text:string,profile:ChapterCastProfile)=>new RegExp(`(?<![\\p{L}\\p{N}])(?:${actor(profile)})(?![\\p{L}\\p{N}])`,'iu').test(text);

/** Keep at least a short excerpt for each populated field when this character is active. */
export function activeCastFacts(cast:readonly ChapterCastProfile[],focus:string,compact=false):string {
  const mentioned=cast.filter(profile=>actorMatches(focus,profile));
  const relevant=mentioned.length?mentioned:cast;
  const limit=Math.max(60,Math.floor((compact?1750:3000)/Math.max(1,relevant.length*fields.length)));
  const terms=new Set(focus.toLowerCase().match(/[\p{L}]{4,}/gu)??[]);
  return relevant.flatMap(profile=>{
    const entries=fields.flatMap(field=>{
      const text=profile.fields[field]?.trim();
      if(!text)return [];
      const passages=text.match(/[^.!?\r\n]+[.!?]*/gu)??[text];
      const ranked=passages.map(passage=>({passage,score:(passage.toLowerCase().match(/[\p{L}]{4,}/gu)??[]).filter(word=>terms.has(word)).length}))
        .sort((a,b)=>b.score-a.score);
      const excerpt=(field==='appearance'?text:ranked[0]?.passage??text).trim();
      return [`${field}: ${excerpt.slice(0,limit)}${excerpt.length>limit?'…':''}`];
    });
    return entries.length?[`${profile.name}\n${entries.join('\n')}`]:[];
  }).join('\n\n');
}

const colors='(?:red|crimson|scarlet|auburn|ginger|copper|orange|black|raven|brown|chestnut|blond(?:e)?|golden|silver|white|gr[ae]y|blue|green|violet|purple|amber|pink|hazel)';
const trait='(?:hair|eyes)';
const colorsByFamily:Record<string,string>={crimson:'red',scarlet:'red',ginger:'red',raven:'black',blonde:'blond',grey:'gray'};
const family=(color:string)=>colorsByFamily[color.toLowerCase()]??color.toLowerCase();

function savedAppearance(text:string,feature:'hair'|'eyes'):string|undefined {
  const descriptor=feature==='hair'?'haired':'eyed';
  const variants=[...text.matchAll(new RegExp(`\\b(${colors})(?:[- ]+)(?:${feature}|${descriptor})\\b`,'gi'))]
    .map(match=>match[1]!);
  const reverse=new RegExp(`\\b${feature}\\s+(?:is |are |was |were |of )?(${colors})\\b`,'gi');
  for(const match of text.matchAll(reverse))variants.push(match[1]!);
  const first=variants[0];
  return first&&variants.every(color=>family(color)===family(first))?first:undefined;
}

const proper="[\\p{Lu}][\\p{L}\\p{M}'’.-]*(?:[ \\t]+[\\p{Lu}][\\p{L}\\p{M}'’.-]*){0,2}";
const parentRoles='(?:mother|father|mom(?:my)?|dad(?:dy)?)';
const parentName=(value:string)=>value.toLowerCase().replace(/^mom(?:my)?$/,'mother').replace(/^dad(?:dy)?$/,'father');

/** The draft needs the actual name and the trait or relation in a direct assertion. */
export function castContinuityCorrections(prose:string,cast:readonly ChapterCastProfile[],authorChoices=''):SceneCorrection[] {
  const appearances=cast.map(profile=>({profile,expected:{
    hair:savedAppearance(profile.fields.appearance??'','hair'),eyes:savedAppearance(profile.fields.appearance??'','eyes'),
  }}));
  const relationships=cast.flatMap(profile=>{
    const evidence=[profile.fields.relationships,profile.fields.history].filter(Boolean).join('\n');
    const owner=`(?:[Tt]heir|[Hh]er|[Hh]is|(?:${actor(profile)})['’]s)`;
    const of=new RegExp(`${owner}\\s+(?:foster |adoptive |biological )?(${parentRoles})\\s+(?:is |was |named |called )?(${proper})\\b`,'gu');
    const before=new RegExp(`(${proper})\\s+(?:is |was )?${owner}\\s+(?:foster |adoptive |biological )?(${parentRoles})\\b`,'gu');
    return [...evidence.matchAll(of)].map(match=>({profile,role:parentName(match[1]!),parent:match[2]!})).concat(
      [...evidence.matchAll(before)].map(match=>({profile,role:parentName(match[2]!),parent:match[1]!})));
  });
  const corrections:SceneCorrection[]=[];
  for(const passage of scenePassages(prose,Infinity)){
    if(/^(?:[“"]|[^:]+:\s)/.test(passage.text))continue;
    const present=appearances.filter(({profile})=>actorMatches(passage.text,profile));
    if(present.length!==1)continue;
    const {profile,expected}=present[0]!;
    const name=`(?<![\\p{L}\\p{N}])(?:${actor(profile)})(?![\\p{L}\\p{N}])`;
    const appearance=new RegExp(`${name}(?:['’]s\\s+|(?:\\s+(?:stepped (?:in|forward)|walked in|entered|appeared|turned|stood))?[, ]+\\s*(?:has|had|with|his|her|their)\\s+)(${colors})[- ]+(${trait})\\b`,'iu');
    const asserted=appearance.exec(passage.text);
    const observed=asserted?.[1], feature=asserted?.[2]?.toLowerCase() as 'hair'|'eyes'|undefined;
    if(observed&&feature&&expected[feature]&&family(observed)!==family(expected[feature]!)){
      const authorized=authorChoices.split(/[.!?\r\n]/).some(clause=>{
        const detail=appearance.exec(clause);
        return detail?.[1]&&detail[2]?.toLowerCase()===feature&&family(detail[1])===family(observed)&&
          !/\b(?:not|wrong|incorrect|avoid|never)\b/i.test(clause);
      });
      if(authorized)continue;
      corrections.push({passage,reason:`The saved Appearance field for ${profile.name} specifies ${expected[feature]} ${feature}. Use that detail and preserve the action.`});
      continue;
    }
    const parentAssertion=new RegExp(`${name}['’]s\\s+(?:foster |adoptive |biological )?(${parentRoles})\\s+(?:is |was |named |called )?(${proper})\\b`,'u');
    const stated=parentAssertion.exec(passage.text);
    if(!stated)continue;
    const role=parentName(stated[1]!),relative=stated[2]!.toLowerCase();
    if(authorChoices.split(/[.!?\r\n]/).some(clause=>{
      const detail=parentAssertion.exec(clause);
      return detail?.[1]&&parentName(detail[1])===role&&detail[2]?.toLowerCase()===relative&&
        !/\b(?:not|wrong|incorrect|avoid|never)\b/i.test(clause);
    }))continue;
    const own=relationships.find(item=>item.role===role&&item.profile.name===profile.name);
    const other=relationships.find(item=>item.role===role&&item.parent.toLowerCase()===relative&&item.profile.name!==profile.name);
    if(own&&own.parent.toLowerCase()!==relative){
      corrections.push({passage,reason:`The saved relationship for ${profile.name} names ${own.parent} as their ${role}. Use that identity.`});
    }else if(!own&&other){
      corrections.push({passage,reason:`The saved profiles identify ${other.parent} as ${other.profile.name}’s ${role}. Remove the unsupported family attribution to ${profile.name}.`});
    }
  }
  return corrections;
}
