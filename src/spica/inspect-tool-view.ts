/** Graph format for read-only tool inspection. The LLM sometimes supplies a
 * structured view descriptor instead of a scalar. Normalize explicit,
 * documented shapes only; never guess an unsupported graph format. */
export type InspectorGraphView = 'schema1' | 'v2' | 'both';
export const inspectorViewSchema = {
  oneOf: [
    {type:'string',enum:['schema1','v2','both']},
    {type:'object',properties:{format:{type:'string',enum:['schema1','v2','both']}},required:['format'],additionalProperties:false},
    {type:'object',properties:{view:{type:'string',enum:['schema1','v2','both']}},required:['view'],additionalProperties:false},
    {type:'object',properties:{type:{type:'string',enum:['schema1','v2','both']}},required:['type'],additionalProperties:false},
    {type:'array',items:{type:'string',enum:['schema1','v2','both']},minItems:1,maxItems:2},
    {type:'null'},
  ],
  description:'Optional graph format: "schema1", "v2", or "both"; a structured {format:"v2"} / {view:"v2"} / {type:"v2"} or an array of formats is also supported. Omit/null defaults to schema1.',
};
export function resolveInspectorView(input: unknown):
  {ok:true;view:InspectorGraphView}|{ok:false;code:'INVALID_GRAPH_VIEW';received:unknown;expected:readonly string[];nextArguments:{view:'schema1'}} {
  if(input==null)return {ok:true,view:'schema1'};
  const value=Array.isArray(input) && input.length>=1 && input.length<=2 &&
    input.every(v=>v==='schema1'||v==='v2'||v==='both') ?
      input.includes('both') || new Set(input).size>1 ? 'both' : input[0] :
    typeof input==='object'&&!Array.isArray(input) ?
      (input as Record<string,unknown>).format??(input as Record<string,unknown>).view??
      (input as Record<string,unknown>).type : input;
  if(value==='schema1'||value==='v2'||value==='both')return {ok:true,view:value};
  return {ok:false,code:'INVALID_GRAPH_VIEW',received:input,
    expected:['schema1','v2','both','{format:"v2"}','{view:"v2"}','{type:"v2"}','["schema1","v2"]'],nextArguments:{view:'schema1'}};
}
