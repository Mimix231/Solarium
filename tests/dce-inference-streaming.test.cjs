'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {streamLlamaTurn}=require('../.test-dist/engine/llama.js');
const {streamContinuousAnswer}=require('../.test-dist/engine/continuous-generation.js');
const {prepareGeneration}=require('../.test-dist/engine/context-window.js');
const model={backend:'llama.cpp',endpoint:'http://127.0.0.1:8080',modelId:'fixture',contextSize:4096,temperature:.5,maxTokens:512};
const caps={contextSize:4096,tools:'supported',reasoning:'observed',contextShift:'supported'};
const initial=[{role:'system',content:'Keep project state.'},{role:'user',content:'Create a platformer.'}];
function sse(chunks){const text=chunks.map(value=>'data: '+JSON.stringify(value)+'\n\n').join('')+'data: [DONE]\n\n';
 const bytes=new TextEncoder().encode(text);
 return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=27)c.enqueue(bytes.slice(i,i+27));c.close();}}),{status:200});}

test('unlimited native output uses bounded n_keep, preserving room for server context shifts',async()=>{
 const prior=global.fetch;let body;
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return sse([
  {choices:[{delta:{reasoning_content:'Inspect the project first. '}}]},
  {choices:[{delta:{content:'Ready to build.'}}]},
  {choices:[{delta:{},finish_reason:'stop'}]},
 ]);};
 try{const result=await streamContinuousAnswer({adapter:{kind:'llama.cpp',countTokens:async()=>80,generate:(...args)=>streamLlamaTurn(...args)},model,capabilities:caps,messages:initial,signal:new AbortController().signal,onAnswer(){},onReasoning(){}});
   assert.equal(body.max_tokens,-1);assert.ok(Number.isInteger(body.n_keep));assert.notEqual(body.n_keep,-1);
   assert.ok(body.n_keep>=0 && body.n_keep<=4096-512-96);assert.equal(body.n_keep,80,'Retain the fitted prompt rather than truncating authoritative instructions');assert.equal(result.answer,'Ready to build.');
 }finally{global.fetch=prior;}
});

test('prompt fitting reserves enough capacity for one action instead of 64 tokens',async()=>{
 const prompt=[{role:'system',content:'original instructions'},
   {role:'system',content:'PROJECT FILE SNAPSHOT: '+ 'x'.repeat(3000)},
   {role:'user',content:'Create the project.'}];
 const adapter={kind:'llama.cpp',countTokens:async(_m,msgs)=>msgs.some(m=>String(m.content).startsWith('PROJECT FILE SNAPSHOT:'))?3890:250};
 const fitted=await prepareGeneration(adapter,model,caps,prompt,new AbortController().signal);
 assert.ok(fitted.discardedHistory>0);assert.equal(fitted.promptTokens,250);
 assert.ok(fitted.contextSize-fitted.promptTokens>=512+96);
 assert.ok(!fitted.messages.some(m=>String(m.content).startsWith('PROJECT FILE SNAPSHOT:')));
});

test('a length-limited native thought reports partial output without executing a tool',async()=>{
 const prior=global.fetch;let reason='',answer='';
 global.fetch=async()=>sse([
  {choices:[{delta:{reasoning_content:'Plan the files.'}}]},
  {choices:[{delta:{tool_calls:[{index:0,id:'call1',function:{name:'apply_project_changes',arguments:'{"files":['}}]}}]},
  {choices:[{delta:{},finish_reason:'length'}]},
 ]);
 try{const result=await streamLlamaTurn(model,initial,caps,{answer:d=>answer+=d,reasoning:d=>reason+=d},new AbortController().signal,{outputTokens:-1,keepTokens:256});
   assert.equal(result.finishReason,'length');assert.equal(answer,'');assert.equal(reason,'Plan the files.');assert.equal(result.calls.length,1);
   assert.equal(result.calls[0].function.arguments,'{"files":[');
 }finally{global.fetch=prior;}
});

test('long reasoning and real native tool action remain in one uninterrupted server request',async()=>{
 const prior=global.fetch;let requests=0,thought='';let proposal='';const longReasoning='Deciding which registered project tool applies. '.repeat(650);
 const chunks=longReasoning.match(/.{1,280}/gs).map(part=>({choices:[{delta:{reasoning_content:part}}]}));
 chunks.push({choices:[{delta:{tool_calls:[{index:0,id:'call-tool-1',function:{name:'plan_project_app',arguments:'{"goal":"platformer"}'}}]}}]});
 chunks.push({choices:[{delta:{},finish_reason:'tool_calls'}]});
 global.fetch=async(_url,init)=>{requests++;const body=JSON.parse(init.body);assert.equal(body.max_tokens,-1);return sse(chunks);};
 try{const turn=await streamContinuousAnswer({adapter:{kind:'llama.cpp',countTokens:async()=>210,generate:(...args)=>streamLlamaTurn(...args)},model,capabilities:caps,messages:initial,
   signal:new AbortController().signal,request:{tools:[{type:'function',function:{name:'plan_project_app',parameters:{type:'object',properties:{goal:{type:'string'}},required:['goal']}}}]},onAnswer(){},onReasoning:t=>thought+=t,onToolDelta:(_i,_name,args)=>proposal=args});
   assert.equal(requests,1);assert.equal(turn.result.finishReason,'tool_calls');assert.equal(thought,longReasoning);
   assert.equal(turn.result.calls[0].function.name,'plan_project_app');assert.equal(proposal,'{"goal":"platformer"}');
 }finally{global.fetch=prior;}
});


test('non-shifting 4K llama reserves ample input headroom and uses a finite native output ceiling',async()=>{
 const prior=global.fetch;let body;
 const noShift={...caps,contextShift:'unsupported'};
 global.fetch=async(_url,init)=>{body=JSON.parse(init.body);return sse([
  {choices:[{delta:{tool_calls:[{index:0,id:'call-42',function:{name:'plan_project_app',arguments:'{"goal":"notes"}'}}]}}]},
  {choices:[{delta:{},finish_reason:'tool_calls'}]},
 ]);};
 try {
  const input=[{role:'system',content:'Instructions'},
   {role:'system',content:'PROJECT FILE SNAPSHOT: '+'old files '.repeat(600)},
   {role:'user',content:'Build a notes app'}];
  const adapter={kind:'llama.cpp',countTokens:async(_model,messages)=>messages.some(m=>String(m.content).startsWith('PROJECT FILE SNAPSHOT:'))?3455:1650,generate:(...args)=>streamLlamaTurn(...args)};
  const turn=await streamContinuousAnswer({adapter,model,capabilities:noShift,messages:input,signal:new AbortController().signal,onAnswer(){},onReasoning(){},request:{tools:[{type:'function',function:{name:'plan_project_app',parameters:{type:'object',properties:{goal:{type:'string'}},required:['goal']}}}]}});
  assert.ok(body.max_tokens>1600,'The actual remaining native KV window must be useful');
  assert.ok(body.max_tokens<4096,'A non-shifting server cannot promise infinite tokens');
  assert.equal(body.n_keep,0);
  assert.equal(turn.result.calls[0].function.name,'plan_project_app');
 } finally {global.fetch=prior;}
});

test('4K no-shift source construction fits real native tool schema and reaches a callable action without a second inference',async()=>{
 const {buildConstructionDecisionContext}=require('../.test-dist/engine/construction/decision-context.js');
 const packet=buildConstructionDecisionContext({
  actionContract:'Use authorized project tools. Never fabricate written files.',
  sparkIdentity:'Dona is a curious, careful Spark. '.repeat(23),
  projectInstructions:'Keep existing user files and preserve the linked root.',
  projectBriefing:'Notes Organizer in its linked project. '+ 'old settings and file details '.repeat(80),
  originalGoal:'Build a Samsung Notes-style app with Markdown 2.0.',
  latestUserRequest:'Build a Samsung Notes-style app with Markdown 2.0.',
  checkpoint:'SOURCE CONSTRUCTION CHECKPOINT: stage plan, inspected true, writes=0. '+ 'historical log '.repeat(40),
  verification:'No project source writes or current checks completed. '+ 'older results '.repeat(90),
  offeredTools:['plan_project_app'],
  lastToolObservation:'PROJECT FILE SNAPSHOT: source root and manifests inspected. '+ 'directory entry '.repeat(115),
 });
 const nativeTool={type:'function',function:{name:'plan_project_app',description:'Save work packages',parameters:{type:'object',properties:{architecture:{type:'string'},steps:{type:'array',items:{type:'object',properties:{id:{type:'string'},files:{type:'array',items:{type:'string'}},acceptance:{type:'array',items:{type:'string'}}},required:['id','files','acceptance']}}},required:['architecture','steps']}}};
 const localCaps={...caps,contextShift:'unsupported'};
 let requests=0;let seen;
 const previous=global.fetch;
 global.fetch=async(_url,init)=>{requests++;seen=JSON.parse(init.body);return sse([
  {choices:[{delta:{tool_calls:[{index:0,id:'real-call-1',function:{name:'plan_project_app',arguments:'{"architecture":"TypeScript","steps":[{"id":"notes","files":["src/notes.ts"],"acceptance":["Notes can be edited"]}]}'}}]}}]},
  {choices:[{delta:{},finish_reason:'tool_calls'}]},
 ]);};
 try{
  const adapter={kind:'llama.cpp',countTokens:async(_m,m)=>m.reduce((n,v)=>n+Math.ceil(String(v.content).length/2)+18,0),generate:(...args)=>streamLlamaTurn(...args)};
  const result=await streamContinuousAnswer({adapter,model,capabilities:localCaps,messages:packet,signal:new AbortController().signal,
   request:{tools:[nativeTool],requireTools:true,toolChoice:'required'},onAnswer(){},onReasoning(){}});
  assert.equal(requests,1);
  assert.equal(seen.max_tokens>512,true);
  assert.equal(seen.n_keep,0);
  assert.equal(seen.tool_choice,'required');
  assert.equal(seen.tools.length,1);
  assert.match(JSON.stringify(seen.messages),/Samsung Notes-style app/);
  assert.equal(result.result.finishReason,'tool_calls');
  assert.equal(result.result.calls[0].function.name,'plan_project_app');
 }finally{global.fetch=previous;}
});

test('tool-aware llama.cpp token counting sends the actual offered schema and tool choice without inference',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const old=global.fetch;let observed;
 global.fetch=async(url,opts)=>{observed={url:String(url),body:JSON.parse(opts.body)};return Response.json({input_tokens:1847});};
 try{
  const offered=[{type:'function',function:{name:'plan_project_app',description:'Plan app',parameters:{type:'object',properties:{architecture:{type:'string'}},required:['architecture']}}}];
  const count=await countChatInputTokens(model,[{role:'system',content:'A'},{role:'system',content:'B'},{role:'user',content:'Build Notes'}],offered,new AbortController().signal,'required');
  assert.equal(count,1847);assert.match(observed.url,/chat\/completions\/input_tokens$/);
  assert.equal(observed.body.messages.length,2,'system prefix is merged just like actual generation');
  assert.equal(observed.body.tools[0].function.name,'plan_project_app');
  assert.equal(observed.body.tool_choice,'required');
 }finally{global.fetch=old;}
});

test('older llama.cpp token servers fall back rather than losing the required tool',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const old=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return new Response('unavailable',{status:404});};
 try{
  const counted=await countChatInputTokens(model,initial,[],new AbortController().signal);
  assert.equal(counted,null);assert.equal(calls,1);
 }finally{global.fetch=old;}
});


test('zero token count from a malformed server response is not trusted as exact input cost',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const old=global.fetch;global.fetch=async()=>Response.json({input_tokens:0});
 try{assert.equal(await countChatInputTokens(model,initial,[],new AbortController().signal),null);}finally{global.fetch=old;}
});

test('end-to-end 4K tool decision uses exact tool-aware count and a single native generation stream',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const prior=global.fetch;let countRequests=0,generationRequests=0,finalRequest;
 const offered=[{type:'function',function:{name:'plan_project_app',description:'Persist the plan.',parameters:{type:'object',properties:{goal:{type:'string'}},required:['goal']}}}];
 global.fetch=async(url,init)=>{
  if(String(url).endsWith('/chat/completions/input_tokens')){
   countRequests++;const payload=JSON.parse(init.body);
   assert.equal(payload.tools.length,1);assert.equal(payload.tool_choice,'required');
   return Response.json({input_tokens:1750});
  }
  assert.ok(String(url).endsWith('/chat/completions'));
  generationRequests++;finalRequest=JSON.parse(init.body);
  return sse([
   {choices:[{delta:{reasoning_content:'I have verified the current project; record an actionable plan.'}}]},
   {choices:[{delta:{tool_calls:[{index:0,id:'call-real',function:{name:'plan_project_app',arguments:'{"goal":"notes"}'}}]}}]},
   {choices:[{delta:{},finish_reason:'tool_calls'}]},
  ]);
 };
 try {
  const adapter={kind:'llama.cpp',countChatTokens:countChatInputTokens,countTokens:async()=>{throw Error('fallback should not be used with exact tool count');},generate:(...args)=>streamLlamaTurn(...args)};
  const result=await streamContinuousAnswer({adapter,model,capabilities:{...caps,contextShift:'unsupported'},messages:[{role:'system',content:'Dona builds apps.'},{role:'user',content:'Build Markdown notes.'}],signal:new AbortController().signal,
   request:{tools:offered,requireTools:true,toolChoice:'required'},onAnswer(){},onReasoning(){}});
  assert.equal(countRequests,1);
  assert.equal(generationRequests,1);
  assert.equal(finalRequest.tools.length,1);
  assert.equal(finalRequest.tool_choice,'required');
  assert.equal(result.result.finishReason,'tool_calls');
  assert.equal(result.result.calls[0].function.name,'plan_project_app');
 }finally{global.fetch=prior;}
});

test('the optional token-count endpoint honors an already-aborted inference request',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const controller=new AbortController();controller.abort();
 const original=global.fetch;let requests=0;
 global.fetch=async()=>{requests++;throw Error('No network request may be sent after cancellation');};
 try {
  await assert.rejects(countChatInputTokens(model,initial,[],controller.signal),/Stopped|Abort/);
  assert.equal(requests,0);
 }finally{global.fetch=original;}
});

test('the token-count helper never sends user prompts to a non-loopback endpoint',async()=>{
 const {countChatInputTokens}=require('../.test-dist/engine/llama.js');
 const old=global.fetch;let requests=0;
 global.fetch=async()=>{requests++;throw Error('External endpoint was contacted');};
 try {
  const malicious={...model,endpoint:'http://example.com:8080'};
  assert.equal(await countChatInputTokens(malicious,initial,[],new AbortController().signal),null);
  assert.equal(requests,0);
 }finally{global.fetch=old;}
});
