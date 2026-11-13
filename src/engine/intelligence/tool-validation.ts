/** Structural tool declaration: validation must not import the agent runtime. */
export interface ToolValidationDefinition {type:'function';function:{name:string;description:string;parameters:{type:'object';properties:Record<string,unknown>;required?:readonly string[];additionalProperties?:boolean}}} 
interface Schema {oneOf?:readonly Schema[];type?:string|readonly string[];properties?:Record<string,Schema>;required?:readonly string[];additionalProperties?:boolean;items?:Schema;enum?:readonly unknown[];minItems?:number;maxItems?:number;minLength?:number;maxLength?:number;minimum?:number;maximum?:number}
export interface ToolIssue {field:string;message:string}
export type ToolValidation={ok:true;value:Record<string,unknown>}|{ok:false;error:{code:'INVALID_ARGUMENTS';tool:string;issues:ToolIssue[];message:string}};
export function validateToolArguments(name:string,raw:string|unknown,definitions:readonly ToolValidationDefinition[]):ToolValidation{
  const issues:ToolIssue[]=[];const definition=definitions.find(t=>t.function.name===name);let data:unknown=raw;
  if(!definition)issues.push({field:name,message:'Tool is not registered or available in this stage.'});
  if(typeof raw==='string'){try{data=JSON.parse(raw);}catch{issues.push({field:name,message:'Malformed JSON; provide a JSON object matching the tool schema.'});}}
  function validate(value:unknown,schema:Schema,path:string,depth=0):void{
    if(depth>12){issues.push({field:path,message:'Arguments are too deeply nested.'});return;}
    if(schema.oneOf){
      // Discriminated operation variants are the model-facing contract, too.
      // Preserve errors from the selected variant rather than reporting dozens
      // of unrelated alternatives when a single field is missing.
      const preferred=schema.oneOf.filter(candidate=>{
        const option=candidate.properties?.op?.enum;
        return !option || !!value && typeof value==='object' && option.includes((value as {op?:unknown}).op);
      });
      const candidates=preferred.length?preferred:schema.oneOf;
      let valid=0;let relevant:ToolIssue[]=[];
      for(const candidate of candidates){
        const start=issues.length;
        validate(value,candidate,path,depth+1);
        const errors=issues.splice(start);
        if(!errors.length)valid++;
        else if(!relevant.length||errors.length<relevant.length)relevant=errors;
      }
      if(valid!==1){
        if(valid>1)issues.push({field:path,message:'Ambiguous edit operation schema.'});
        else if(preferred.length)issues.push(...relevant);
        else issues.push({field:`${path}.op`,message:`Unknown edit operation. Choose ${[...new Set(schema.oneOf.flatMap(candidate=>candidate.properties?.op?.enum??[]))].join(' | ')}.`});
      }
      return;
    }

    const types=Array.isArray(schema.type)?schema.type:[schema.type];const type=value===null?'null':Array.isArray(value)?'array':typeof value;
    if(schema.type&&!types.includes(type)&&!(types.includes('integer')&&typeof value==='number'&&Number.isInteger(value))){issues.push({field:path,message:`Expected ${types.join(' | ')}.`});return;}
    if(schema.enum&&!schema.enum.includes(value))issues.push({field:path,message:`Choose ${schema.enum.join(' | ')}.`});
    if(type==='object'){
      const obj=value as Record<string,unknown>;
      for(const field of schema.required??[])if(!(field in obj)){const values=schema.properties?.[field]?.enum;issues.push({field:`${path}.${field}`,message:`is required${values?`; choose ${values.join(' | ')}`:''}.`});}
      for(const [key,item]of Object.entries(obj)){if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties??{},key))issues.push({field:`${path}.${key}`,message:'Unexpected property.'});else if(schema.properties?.[key])validate(item,schema.properties[key]!,`${path}.${key}`,depth+1);}
    }
    if(Array.isArray(value)){if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??1000))issues.push({field:path,message:`Array must contain ${schema.minItems??0}–${schema.maxItems??1000} items.`});value.forEach((v,i)=>schema.items&&validate(v,schema.items,`${path}[${i}]`,depth+1));}
    if(typeof value==='string'){
      if(value.length>(schema.maxLength??2_000_000)||value.length<(schema.minLength??0))issues.push({field:path,message:'Text length is outside the supported range.'});
      if(/(?:^|\.)(path)$/.test(path)&&(!value||/^(?:[A-Za-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)|:/.test(value)||[...value].some(c=>c.charCodeAt(0)<32)))issues.push({field:path,message:'Use a safe project-relative path inside the linked folder.'});
    }
    if(typeof value==='number'&&(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))issues.push({field:path,message:'Number is outside the supported range.'});
  }
  if(definition)validate(data,definition.function.parameters as Schema,name);
  if(name==='replace_project_text'&&data&&typeof data==='object'){const a=data as Record<string,unknown>;if(typeof a.expected_fragment==='string'&&a.expected_fragment===a.replacement)issues.push({field:name,message:'Replacement is identical to the original. No edit would occur; choose a real change or a different action.'});}
  if(name==='apply_project_changes'&&data&&typeof data==='object'){
    const files=(data as {files?:unknown}).files;if(Array.isArray(files)){if(files.length<1||files.length>12)issues.push({field:`${name}.files`,message:'Provide 1–12 files.'});for(const f of files)if(f&&typeof f.expected==='string'&&f.expected===f.content)issues.push({field:`${name}.files`,message:'A file matches its expected original exactly. Omit unchanged files; no edit would occur.'});const paths=files.map(f=>String(f?.path??'').replaceAll('\\','/').toLowerCase());if(new Set(paths).size!==paths.length)issues.push({field:`${name}.files`,message:'Duplicate file paths.'});}
  }
  return issues.length?{ok:false,error:{code:'INVALID_ARGUMENTS',tool:name,issues,message:issues.map(i=>`${i.field} ${i.message}`).join(' ')}}:{ok:true,value:data as Record<string,unknown>};
}
