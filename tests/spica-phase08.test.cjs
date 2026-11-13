'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require(require('child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript');
const root=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
function load(p,mocks){
 const compiled=ts.transpileModule(source(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:id=>{
   if(!Object.hasOwn(mocks,id))throw Error('Unexpected module '+id);return mocks[id];
 },AbortController,DOMException,TextEncoder,URL,console,Date,Set,Map},{filename:p});
 return mod.exports;
}
const page=(url,title,body,hash,links=[])=>({url,title,text:body,contentHash:hash,retrievedAt:'2026-11-12T09:00:00Z',locator:'#documentation',links});
const fakePages={
 'https://docs.example.org/api/v1':page('https://docs.example.org/api/v1','Example API v1','API version 1 uses the legacy request interface.','hash-v1', [{url:'https://docs.example.org/api/v2',title:'Current version 2 reference'}]),
 'https://docs.example.org/api/v2':page('https://docs.example.org/api/v2','Example API v2','API version 2 uses a new request interface. Version 1 is superseded.','hash-v2'),
 'https://independent.example.net/reference':page('https://independent.example.net/reference','Independent compatibility','Version 2 introduced a new request interface.','hash-v2-independent'),
};
const results=[{url:'https://docs.example.org/api/v1',title:'Example API version 1',excerpt:'Legacy API documentation'},
 {url:'https://independent.example.net/reference',title:'Independent compatibility',excerpt:'Version 2'}];
const providers=[];
const mocks={
 '../domain/types':{uid:()=>`run-${providers.length}`},
 '../research/research':{matchesSearchQuery:()=>true,rankCandidates:s=>s,sceneIntent:q=>({query:q})},
 '../sources/repository':{
  DuplicateSourceError:class DuplicateSourceError extends Error{},words:s=>s.toLowerCase().match(/[a-z]+/g)||[],
  SourceRepository:class {async list(){return []}async create(input){return{id:'saved-1',title:input.title,data:{origin:input.origin}}}},
 },
};
const {SpicaResearchRun}=load('src/spica/research-run.ts',mocks);
const {spicaResearchTools,executeSpicaResearchTool,spicaResearchNames,spicaResearchNetworkNames}=load('src/spica/research-tools.ts',{
 '../sources/repository':mocks['../sources/repository'],
});
function fixture(enabled=true){let requests=0;
 const provider={kind:'fixture',search:async()=>{requests++;return results},read:async url=>{requests++;if(!fakePages[url])throw Error('No fixture page');return fakePages[url]}};
 const run=new SpicaResearchRun(async()=>{providers.push(provider);return provider},()=>enabled);
 return {run,requests:()=>requests};
}
const call=(run,name,args={},web=true)=>executeSpicaResearchTool(name,args,{run},'test-project',new AbortController().signal,web).then(JSON.parse);

test('Phase 8 registered names are unique, callable and have strict argument schemas',()=>{
 assert.equal(spicaResearchTools.length,10);
 assert.equal(spicaResearchNames.size,spicaResearchTools.length);
 for(const tool of spicaResearchTools){assert.equal(tool.function.parameters.additionalProperties,false);assert.ok(tool.function.name.startsWith('spica_research_'))}
 assert.ok(spicaResearchNetworkNames.has('spica_research_follow'));
 assert.equal(spicaResearchNetworkNames.has('spica_research_next'),false);
});

test('observation-led research reads, follows primary reference, detects version mismatch, compares and saves verified SOURCE provenance',async()=>{
 const {run}=fixture();
 const initial=await call(run,'spica_research_next',{goal:'Example API v2'});
 assert.equal(initial.status,'need_evidence');assert.equal(initial.recommendations[0].tool,'spica_research_search');
 const found=await call(run,'spica_research_search',{query:'Example API version'});
 assert.equal(found.results.length,2);assert.ok(found.results[0].id.includes('https://'));
 const next=await call(run,'spica_research_next',{goal:'What API version is current?'});
 assert.equal(next.recommendations[0].tool,'spica_research_read');
 const read=await call(run,'spica_research_read',{sourceId:found.results[0].id});
 assert.equal(read.contentHash,'hash-v1');assert.equal(read.title,'Example API v1');
 const links=await call(run,'spica_research_links',{sourceId:found.results[0].id});
 assert.equal(links.links[0].url,'https://docs.example.org/api/v2');
 const followed=await call(run,'spica_research_follow',{sourceId:found.results[0].id,url:links.links[0].url});
 assert.equal(followed.observation.page.contentHash,'hash-v2');
 const independent=await call(run,'spica_research_read',{sourceId:found.results[1].id});
 assert.equal(independent.contentHash,'hash-v2-independent');
 const comp=await call(run,'spica_research_compare',{first:found.results[0].id,second:followed.sourceId});
 assert.equal(comp.sameExcerpt,false);assert.equal(comp.linked,true);
 assert.equal(comp.versionMentionMismatch,true);
 assert.deepEqual(Array.from(comp.explicitVersionMentions.first),['1']);
 const assessed=await call(run,'spica_research_claim',{claim:'API version 2 uses a new request interface',sourceId:followed.sourceId});
 assert.equal(assessed.verdict,'unverified');assert.ok(assessed.coverage>0.5);
 const saved=await call(run,'spica_research_save',{sourceId:followed.sourceId});
 assert.equal(saved.saved,true);assert.equal(saved.origin.url,'https://docs.example.org/api/v2');
 const status=await call(run,'spica_research_status');
 assert.equal(status.sources.length,3);assert.ok(status.sources.every(s=>s.page));
 const stopped=await call(run,'spica_research_stop');assert.equal(stopped.stopped,true);
 await assert.rejects(()=>call(run,'spica_research_search',{query:'new query'}),/stopped/i);
});

test('Web Search OFF and cancellation deny network, no provider calls; stop cannot be bypassed',async()=>{
 const {run,requests}=fixture(false);
 assert.equal((await call(run,'spica_research_status')).searchesLeft,4);
 await assert.rejects(()=>call(run,'spica_research_search',{query:'private data'},false),/OFF/);
 await assert.rejects(()=>call(run,'spica_research_search',{query:'private data'},true),/OFF/);
 assert.equal(requests(),0);
 const live=fixture();const controller=new AbortController();controller.abort();
 await assert.rejects(()=>executeSpicaResearchTool('spica_research_search',{query:'test'},{run:live.run},'test-project',controller.signal,true),/cancel/);
 assert.equal(live.requests(),0);
});

test('invalid sources and repeat queries are rejected before new web calls',async()=>{
 const {run,requests}=fixture();
 await call(run,'spica_research_search',{query:'API'});assert.equal(requests(),1);
 await assert.rejects(()=>call(run,'spica_research_search',{query:'API'}),/already ran/);
 assert.equal(requests(),1);
 await assert.rejects(()=>call(run,'spica_research_read',{sourceId:'https://evil.example.org/'}),/Choose a source/);
 await assert.rejects(()=>call(run,'spica_research_follow',{sourceId:'https://docs.example.org/api/v1',url:'https://evil.example.org/'}),/returned reference/);
 assert.equal(requests(),1);
});

test('cross-site citations can be followed only when present on a retrieved page',async()=>{
 const origin='https://docs.example.org/api/v1';
 const oldLinks=fakePages[origin].links;
 fakePages[origin].links=[...oldLinks,{url:'https://outside.example.com/official',title:'External official reference'}];
 try{const {run}=fixture();const found=await call(run,'spica_research_search',{query:'API'});
 await call(run,'spica_research_read',{sourceId:found.results[0].id});
 const links=await call(run,'spica_research_links',{sourceId:found.results[0].id});
 assert.ok(links.links.some(link=>link.url==='https://outside.example.com/official'));
 await assert.rejects(()=>call(run,'spica_research_follow',{sourceId:found.results[0].id,url:'https://internal.local/secrets'}),/returned reference/);
 }finally{fakePages[origin].links=oldLinks}
});

test('source registry distinguishes block values from function names and exposes one canonical graph reader',()=>{
 const code=source('src/spica/tools.ts');const central=source('src/engine/tools.ts');const permission=source('src/engine/action-permissions.ts');
 assert.match(code,/define\('list_solarium_tools'/);
 assert.match(code,/define\('inspect_solarium_tool'/);
 assert.match(code,/define\('inspect_spica_identifier'/);
 assert.match(code,/spicaResearchTools/);
 assert.match(code,/define\('read_spica_graph'/);
 assert.doesNotMatch(code,/define\('read_spica_v2_graph'/);
 assert.match(code,/v2Info/);
 assert.match(central,/spicaResearchNames\.has\(name\)/);
 assert.match(permission,/spicaResearchNetworkNames/);
 assert.match(source('src/engine/agent.ts'),/spicaResearchIntent/);
 assert.match(source('src/spica/tool-intelligence.ts'),/BLOCK_ID_NOT_TOOL/);
});

test('research tool selection does not suppress contract inspection or a preflight-approved source write',()=>{
 const tools=source('src/spica/tools.ts');
 const start=tools.indexOf('export function selectSpicaTools(');
 const end=tools.indexOf('export async function executeSpicaTool(',start);
 const selection=tools.slice(start,end);
 assert.ok(start>=0 && end>start);
 assert.ok(selection.indexOf("last === 'check_spica_tool_call' && state.validatedAction") < selection.indexOf('state.researchIntent ?'));
 assert.ok(selection.indexOf("last === 'inspect_spica_tool'") < selection.indexOf('state.researchIntent ?'));
 assert.match(selection,/spica_research_save/);
});

test('central registry inspection supports complete pagination instead of truncating callable tool discovery',()=>{
 const code=source('src/spica/tools.ts');
 assert.match(code,/totalRegistered:contracts\.names\(\)\.length/);
 assert.match(code,/totalMatching:filtered\.length/);
 assert.match(code,/hasMore:offset\+limit<filtered\.length/);
 assert.match(code,/nextOffset:Math\.min\(offset\+limit,filtered\.length\)/);
 assert.doesNotMatch(code,/toolDefinitions\.slice\(0,150\)/);
});
