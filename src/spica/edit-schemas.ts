/** Canonical, operation-level contract for BOTH graph formats.
 * This object is advertised to Sparks, used by preflight and validated again
 * at dispatch. Do not maintain a second list of permissive edit parameters.
 */
const id = { type:'string', minLength:1, maxLength:120 };
const label = { type:'string', minLength:1, maxLength:80 };
const text = { type:'string' };
const flag = { type:'boolean' };
const number = { type:'number' };
const value = { type:['string','boolean','number','null'] };
const object = (properties:Record<string,unknown>, required:string[] = []) =>
  ({type:'object',additionalProperties:false,properties,required});
const array = (items:unknown, maxItems=1000) => ({type:'array',items,maxItems});
const variant = (op:string, properties:Record<string,unknown>, required:string[]) => object({
  op:{type:'string',enum:[op]},...properties,
},['op',...required]);
const field = object({
  key:id,label,type:{type:'string',enum:['text','boolean','reference','number','choice']},
  initial:value,required:flag,multiline:flag,filter:flag,collection:id,choices:array(label,24),min:number,max:number,
},['key','label','type']);
const collection = object({id,label,singular:label,fields:{...array(field,32),minItems:1}},['id','label','singular','fields']);
const screen = object({
  id,label,view:{type:'string',enum:['list','form','review','table','models','game']},collection:id,
  intro:text,buttons:array(object({id,label,screen:id},['id','label','screen']),32),
  fields:array(id,32),query:{type:'string',maxLength:256},submit:id,submitLabel:label,
  filter:id,export:flag,mapping:flag,layout:{type:'string',enum:['stack','grid','split']},
  scene:{type:'object'},table:{type:'object'},
},['id','label','view']);
const condition=object({field:id,op:{type:'string',enum:['eq','ne','lt','lte','gt','gte']},value,compareField:id},['field','op']);
const step=object({
  id, action:{type:'string',enum:['validate','set','format','save','navigate','status']},when:condition,
  field:id,value,template:text,screen:id,text,
},['id','action']);
const scenarioStep=object({
  action:{type:'string',enum:['screen','fill','submit','load_csv','edit_cell','map_column','stage_csv','table_query','transfer','move_player','expect']},
  screen:id,field:id,value,text,twice:flag,row:number,column:number,filter:flag,sort:id,
  direction:{type:'string'},operation:{type:'string',enum:['import','csv']},
  alert:text,count:number,stored:number,invalidRows:number,stagedRows:number,importBlocked:flag,
  exportIncludes:text,playerAt:{type:'array',items:number,minItems:2,maxItems:2},goalReached:flag,firstRow:text,
  badge:text,layoutClean:flag,
},['action']);
const flow=object({id,collection:id,steps:{...array(step,40),minItems:1}},['id','collection','steps']);
const scenario=object({id,label,steps:{...array(scenarioStep,100),minItems:1},reopened:array(scenarioStep,100)},['id','label','steps']);
const style={target:id,property:id,state:{type:'string',enum:['base','hover','selected','focus']},value:{type:['string','integer','null']}};
const capability={type:'string',enum:['records.write','files.open','files.export','custom.transform']};
const preferenceType={type:'string',enum:['boolean','text','choice']};
const v1:Record<string, ReturnType<typeof variant>>={
  install_recipe:variant('install_recipe',{recipe:{type:'string',enum:['quick_capture','notebooks','model_organizer']}},['recipe']),
  add_collection:variant('add_collection',{collection},['collection']),
  add_record_field:variant('add_record_field',{collection:id,field},['collection','field']),
  put_screen:variant('put_screen',{screen},['screen']),
  put_flow:variant('put_flow',{flow},['flow']),
  put_scenario:variant('put_scenario',{scenario},['scenario']),
  set_start_screen:variant('set_start_screen',{screen:id},['screen']),
  grant_capability:variant('grant_capability',{capability},['capability']),
  revoke_capability:variant('revoke_capability',{capability},['capability']),
  set_style:variant('set_style',style,['target','property','value']),
  add_page:variant('add_page',{id,label},['id','label']),
  add_setting:variant('add_setting',{page:id,key:id,label,type:preferenceType,initial:value,choices:array(label,24),multiline:flag},['page','key','label','initial']),
  label_setting:variant('label_setting',{key:id,label},['key','label']),
  remove_setting:variant('remove_setting',{key:id},['key']),
  add_record_toggle:variant('add_record_toggle',{key:id,label,initial:flag,filter:flag},['key','label','initial']),
  rename:variant('rename',{name:label},['name']),
};
const typedValue=object({
  kind:{type:'string',enum:['string','number','boolean','null','unknown','void','ui','record','array','event','async','reference','capability','union']},
  fields:{type:'object'},open:flag,element:{type:'object'},payload:{type:'object'},result:{type:'object'},
  collection:id,permission:id,options:array({type:'object'},16),
},['kind']);
const port=object({id,type:typedValue,maxConnections:{type:'integer',minimum:1},required:flag},['id','type']);
const lock=object({id,version:{type:'string',minLength:1},availability:{type:'string',enum:['registered','placeholder']}},['id','version','availability']);
const metadata=object({label,x:number,y:number,readonly:flag});
const node=object({id,block:lock,scope:id,inputs:array(port,64),outputs:array(port,64),config:{type:'object'},metadata},['id','block','scope','inputs','outputs','config']);
const endpoint=object({node:id,port:id},['node','port']);
const edge=object({id,kind:{type:'string',enum:['data','event','reference']},from:endpoint,to:endpoint,
  feedback:object({maxIterations:{type:'integer',minimum:1,maximum:10000}},['maxIterations'])},['id','kind','from','to']);
const scope=object({id,parent:{type:['string','null']},label},['id','parent','label']);
const v2:Record<string, ReturnType<typeof variant>>={
  rename:variant('rename',{name:label},['name']),
  add_scope:variant('add_scope',{scope},['scope']),
  remove_scope:variant('remove_scope',{id},['id']),
  add_node:variant('add_node',{node},['node']),
  /** Explicit registry-backed adapter instantiation; no guessed port contracts. */
  add_block:variant('add_block',{id,blockId:id,version:{type:'string',enum:['1']},config:{type:'object'},label,scope:id},['id','blockId']),
  remove_node:variant('remove_node',{id},['id']),
  set_node_config:variant('set_node_config',{id,config:{type:'object'}},['id','config']),
  move_node:variant('move_node',{id,x:number,y:number},['id','x','y']),
  connect:variant('connect',{edge},['edge']),
  disconnect:variant('disconnect',{id},['id']),
};
export const v1EditOperations=Object.keys(v1);
export const v2EditOperations=Object.keys(v2);
export function spicaEditOperationSchema(view:'schema1'|'v2',operation:string):unknown|null {
  return (view==='v2'?v2:v1)[operation]??null;
}
export const unifiedSpicaEditParameters={
  type:'object' as const,additionalProperties:false,
  properties:{
    revision:{type:'integer',minimum:1},
    view:{type:'string',enum:['schema1','v2'],description:'Graph format. Omit only for existing schema-1 edits; use v2 for universal node/port edits.'},
    edits:{type:'array',minItems:1,maxItems:12,items:{
      oneOf:[...Object.values(v1),...Object.entries(v2).filter(([op])=>op!=='rename').map(([,schema])=>schema)],
      description:'Use inspect_params({view,operation}) for the exact operation schema. Each edit is validated against its operation-specific required fields.'}},
  },required:['revision','edits'],
};
export function validEditOperations(view:'schema1'|'v2', edits:unknown): boolean {
  return Array.isArray(edits) && edits.length>0 && edits.length<=12 && edits.every(edit=>
    !!edit && typeof edit==='object' && typeof edit.op==='string' && Object.hasOwn(view==='v2'?v2:v1,edit.op));
}

/** A small, fully explicit tool declaration for the operation(s) already
 * inspected/preflighted. It is derived from the canonical schema above; there
 * is no independently maintained tool contract. This keeps one tool usable by
 * models with smaller context windows rather than advertising 25 variants.
 */
export interface SpicaEditScope {view:'schema1'|'v2';operations:string[]}
export function spicaScopedEditParameters(scope:SpicaEditScope) {
  const operations=[...new Set(scope.operations)];
  const variants=operations.map(op=>spicaEditOperationSchema(scope.view,op));
  if(!operations.length || variants.some(schema=>!schema))throw Error('Unknown edit operation in scoped contract.');
  return {...unifiedSpicaEditParameters,properties:{...unifiedSpicaEditParameters.properties,
    view:{type:'string',enum:[scope.view]},
    edits:{type:'array',minItems:1,maxItems:12,items:{oneOf:variants}}},
    required:scope.view==='v2'?['revision','view','edits']:['revision','edits']};
}
