import {registerProjectCommand,runProjectCommand} from '../engine/intelligence/commands';

/** Independent acceptance code is supplied by Solarium after generation, never by the tested model. */
export async function taskBoardAcceptance(root:string,signal:AbortSignal){
  const script=`
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createApp} from './src/server.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-app-acceptance-'));const data=path.join(dir,'data.json');let app=createApp(data);let base='';
async function start(){await new Promise(function(resolve){app.listen(0,'127.0.0.1',resolve)});base='http://127.0.0.1:'+app.address().port;}
async function request(route,method='GET',body){return await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
try{await start();assert.deepEqual(await (await request('/api/tasks')).json(),[]);let response=await request('/api/tasks','POST',{title:'Feed the birds',priority:'high',dueDate:'2026-11-03'});assert.equal(response.status,201);const task=await response.json();assert.equal(task.title,'Feed the birds');assert.equal(task.completed,false);assert.equal(task.priority,'high');assert.ok(task.id);
for(const invalid of [{title:''},{title:'Bad',priority:'invalid'},{title:'Bad',dueDate:'not-a-date'}]){assert.equal((await request('/api/tasks','POST',invalid)).status,400);}
response=await request('/api/tasks/'+task.id,'PATCH',{completed:true,title:'Birds fed'});assert.equal(response.status,200);assert.equal((await response.json()).completed,true);assert.equal((await request('/api/tasks/missing','PATCH',{completed:true})).status,404);assert.equal((await request('/api/tasks/'+task.id,'PATCH',{completed:'yes'})).status,400);
assert.equal((await request('/api/settings','PATCH',{theme:'light',sort:'priority'})).status,200);assert.equal((await request('/api/settings','PATCH',{theme:'invalid'})).status,400);
await new Promise(function(resolve){app.close(resolve)});app=createApp(data);await start();const tasks=await (await request('/api/tasks')).json();assert.equal(tasks.length,1);assert.equal(tasks[0].title,'Birds fed');assert.equal(tasks[0].completed,true);const settings=await (await request('/api/settings')).json();assert.equal(settings.theme,'light');assert.equal(settings.sort,'priority');const page=await request('/');assert.equal(page.status,200);assert.ok((await page.text()).toLowerCase().includes('task'));assert.equal((await request('/api/tasks/'+task.id,'DELETE')).status,204);assert.deepEqual(await (await request('/api/tasks')).json(),[]);console.log('Independent HTTP, invalid input, CRUD, settings and restart persistence assertions passed.');
}finally{await new Promise(function(resolve){app.close(resolve)});assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));fs.rmSync(dir,{recursive:true});}
`.replace(/\s+/g,' ').trim();
  const command=await registerProjectCommand(root,{program:'node',args:['--input-type=module','-e',script],cwd:'.',purpose:'Solarium independent application HTTP/restart acceptance',kind:'check',network:false});
  return runProjectCommand(root,command.id,false,signal);
}
