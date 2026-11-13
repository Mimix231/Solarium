const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace, validateSpark } = require('../.test-dist/domain/validation.js');
const { forkChatSession } = require('../.test-dist/domain/conversations.js');
const { runAgent } = require('../.test-dist/engine/agent.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');
const root = path.join(__dirname, '..');

test('creator projects persist and only valid project associations are retained', () => {
  const w = defaultWorkspace();
  const project = {id:'project-1',name:'My Game',description:'Custom game',instructions:'Use TypeScript.',folder:'E:\\Projects\\MyGame',sparkId:w.sparks[0].id,modelId:null,createdAt:'2026-10-09',updatedAt:'2026-10-09'};
  w.projects = [project]; w.activeProjectId = project.id;
  w.sessions = [{id:'chat-1',title:'Design',sparkId:w.sparks[0].id,modelId:null,projectId:project.id,mode:'work',messages:[],createdAt:'now',updatedAt:'now'}];
  const loaded = validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(loaded.projects[0].folder, 'E:\\Projects\\MyGame');
  assert.equal(loaded.activeProjectId, project.id);
  assert.equal(loaded.sessions[0].projectId, project.id);
  w.projects = []; assert.equal(validateWorkspace(w).sessions.length, 0, 'orphaned private project chats must never appear in all conversations');
});

test('conversation branches preserve their project and message attachments without linking mutable objects', () => {
  const w = defaultWorkspace();
  const src={id:'old',title:'Demo',sparkId:w.sparks[0].id,projectId:'demo',modelId:null,mode:'conversation',messages:[{id:'one',role:'user',createdAt:'now',content:'File',attachments:[{id:'file',name:'test.txt',kind:'text',mime:'text/plain',size:2,text:'ok'}]}],createdAt:'now',updatedAt:'now'};
  const branch=forkChatSession(src,'one');
  assert.equal(branch.projectId,'demo');
  branch.messages[0].attachments[0].text='edited';
  assert.equal(src.messages[0].attachments[0].text,'ok');
});

test('imported messages reject javascript links, unknown binaries, and oversized image blobs', () => {
  const w=defaultWorkspace();
  w.sessions=[{id:'chat',title:'Files',sparkId:w.sparks[0].id,modelId:null,mode:'work',createdAt:'now',updatedAt:'now',messages:[{id:'msg',role:'user',content:'hello',createdAt:'now',sources:[{url:'javascript:alert(1)',title:'bad'},{url:'https://docs.example.org/a',title:'Docs'}],attachments:[{name:'untrusted.svg',mime:'image/svg+xml',kind:'image',size:50,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='},{name:'ok.md',mime:'text/plain',kind:'text',size:10,text:'# Hello'}]}]}];
  const result=validateWorkspace(w).sessions[0].messages[0];
  assert.equal(result.sources.length,1);
  assert.equal(result.attachments[0].dataUrl,undefined);
  assert.equal(result.attachments[1].text,'# Hello');
});

test('anime appearance survives export/import for multiple eyes, irises, hats, face masks and cosmetics', () => {
  const w=defaultWorkspace();
  const base=w.sparks[0];
  for(const patch of [{hairstyle:'wolf-cut',eyeShape:'droopy',irisPattern:'sunburst',mouth:'fang',accessory:'face-mask',outfit:'kimono',makeup:'freckles'}, {hairstyle:'braided-crown',eyeShape:'wide',irisPattern:'flower',mouth:'cat-smile',accessory:'witch-hat',accessorySecondary:'glasses'}]) {
    const spark=validateSpark({...base,avatar:{...base.avatar,anime:{...base.avatar.anime,...patch}}});
    for(const key of Object.keys(patch)) assert.equal(spark.avatar.anime[key],patch[key]);
  }
});

test('both accessory slots and portrait elements survive a saved workspace reload', () => {
  const workspace = defaultWorkspace();
  const anime = workspace.sparks[0].avatar.anime;
  const additions = { accessory: 'moon-pin', accessorySecondary: 'pocket-bird', accessoryAccent: '#e2b79f',
    outfit: 'sweater', bodyShape: 'petite', neckWidth: 112, ears: 'pointed', nose: 'button', backdrop: 'orbit' };
  Object.assign(anime, additions);
  const restored = validateWorkspace(JSON.parse(JSON.stringify(workspace))).sparks[0].avatar.anime;
  for (const [key, value] of Object.entries(additions)) assert.equal(restored[key], value);
  anime.accessorySecondary = 'flower-crown';
  assert.equal(validateSpark(workspace.sparks[0]).avatar.anime.accessorySecondary, 'flower-crown');
});

test('local model prompt includes project instructions and attached source text without requiring a planner', async () => {
  const prev=global.fetch;
  let body;
  global.fetch=async (url, options)=>{
    if(url.endsWith('/props')) return Response.json({chat_template:'text only'});
    if(url.endsWith('/v1/models')) return Response.json({data:[{id:'test'}]});
    body=JSON.parse(options.body);
    const chunk=`data: ${JSON.stringify({choices:[{delta:{content:'File inspected.'}}]})}\n\n`;
    return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(chunk));c.close();}}),{status:200});
  };
  try {
    const w=defaultWorkspace();
    const model={id:'model',modelId:'test',endpoint:'http://127.0.0.1:8080',temperature:0.5,maxTokens:100,backend:'llama.cpp'};
    const session={id:'one',mode:'work',messages:[{id:'one',role:'user',content:'Inspect',createdAt:'now',attachments:[{id:'att',name:'code.ts',kind:'text',size:8,mime:'text/plain',text:'const n=1;'}]}]};
    const answer=await runAgent({spark:w.sparks[0],model,session,memories:[],preferences:w.preferences,events:new AgentEventEmitter(()=>{}),signal:new AbortController().signal,projectInstructions:'Only TypeScript changes',onAnswer:()=>{},onApproval:async()=>'deny'});
    assert.equal(answer,'File inspected.');
    assert.match(JSON.stringify(body.messages),/Only TypeScript changes/);
    assert.match(JSON.stringify(body.messages),/const n=1/);
  } finally {global.fetch=prev;}
});

test('website and file access are native commands with project-root guarding and public HTTPS checks', () => {
  const native=fs.readFileSync(path.join(root,'src-tauri/src/creator.rs'),'utf8');
  for(const required of ['safe_root','safe_file','read_project_file','write_project_file','list_project_files','search_public_web','read_public_webpage','public_https','spawn_blocking','Policy::none']) assert.ok(native.includes(required),required);
  assert.ok(native.includes('is_symlink'));
  assert.ok(native.includes('File changed on disk'));
});
