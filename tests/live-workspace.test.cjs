const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { streamedProjectFiles, workKindForTool } = require('../.test-dist/engine/live-workspace.js');
const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');

const call = (files) => JSON.stringify({ files });

test('uncommitted source appears progressively as tool arguments stream', () => {
  const complete = call([{ path: 'src/App.tsx', content: 'export const Demo = () => "<b>hello</b>";\n', expected: null }]);
  const partial = complete.slice(0, complete.indexOf('hello') + 3);
  const preview = streamedProjectFiles('apply_project_changes', partial);
  assert.equal(preview[0]?.path, 'src/App.tsx');
  assert.equal(preview[0]?.complete, false);
  assert.match(preview[0]?.content ?? '', /<b>hel/);
  assert.equal(streamedProjectFiles('apply_project_changes', complete)[0]?.complete, true);
  assert.equal(streamedProjectFiles('read_project_file', complete).length, 0);
});

test('multifile editor follows each file, never marks an incomplete JSON object saved', () => {
  const first = {path:'src/App.tsx',content:'export const X = 1;\n', expected:null};
  const second = {path:'src/theme.css',content:':root { color: red; }',expected:null};
  const json = call([first,second]);
  const preview = streamedProjectFiles('apply_project_changes', json.slice(0, json.indexOf('red') + 2));
  assert.equal(preview.length, 2);
  assert.equal(preview[0]?.complete, true);
  assert.equal(preview[1]?.complete, false);
  assert.equal(preview[1]?.path, second.path);
  const final = streamedProjectFiles('apply_project_changes', json);
  assert.equal(final[1]?.content, second.content);
  assert.equal(final[1]?.complete, true);
});

test('precise replacements stream actual replacement text and escaped Unicode', () => {
  const json = JSON.stringify({path:'src/App.tsx', expected_fragment:'return null;',replacement:'return "你好 🌌";'});
  const items = streamedProjectFiles('replace_project_text', json);
  assert.deepEqual(items,[{path:'src/App.tsx',content:'return "你好 🌌";',complete:true}]);
  assert.equal(workKindForTool('run_project_check'), 'check');
  assert.equal(workKindForTool('search_web'), 'search');
  assert.equal(workKindForTool('search_spica_warehouse'), 'search');
  assert.equal(workKindForTool('inspect_spica_component'), 'inspect');
  assert.equal(workKindForTool('unknown'), null);
});

test('real tool-call SSE deltas reach the source viewer without fabricating an assistant answer', async () => {
  const original = global.fetch;
  const payload = call([{path:'src/App.tsx',content:'export const App = () => 1;',expected:null}]);
  const toolDeltas = [];
  global.fetch = async () => new Response(new ReadableStream({start(controller) {
    const encoder = new TextEncoder();
    const fragments = [payload.slice(0,50),payload.slice(50,75),payload.slice(75)];
    fragments.forEach((argumentsFragment,index) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{tool_calls:[{index:0,...(index === 0 ? {id:'call-1',function:{name:'apply_project_changes',arguments:argumentsFragment}} : {function:{arguments:argumentsFragment}})}]}}]})}\n\n`)));
    controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'tool_calls'}]})+'\n\n'));
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  }}));
  try {
    const answer=[];
    const result=await streamLlamaTurn({endpoint:'http://127.0.0.1:8080',modelId:'demo',temperature:.4,maxTokens:200}, [{role:'user',content:'Create a file'}], {tools:'supported'}, {
      answer:text=>answer.push(text),reasoning:()=>{},toolDelta:(index,name,args)=>toolDeltas.push({index,name,files:streamedProjectFiles(name,args)})
    },new AbortController().signal);
    assert.equal(answer.length,0);
    assert.equal(result.calls[0].function.arguments,payload);
    assert.ok(toolDeltas.some(delta=>delta.files.some(file=>!file.complete)));
    assert.equal(toolDeltas.at(-1).files[0].content, 'export const App = () => 1;');
  } finally { global.fetch=original; }
});

test('operation audit entries survive restart and remain project-conversation scoped', () => {
  const workspace=defaultWorkspace();
  const events=[];
  const emitter=new AgentEventEmitter(event=>events.push(event),'project-session');
  emitter.operation('generate','started','src/App.tsx','Received streamed tool arguments.');
  emitter.operation('generate','completed','src/App.tsx','Native file write succeeded.');
  workspace.workEvents=events;
  const recovered=validateWorkspace(JSON.parse(JSON.stringify(workspace))).workEvents;
  assert.deepEqual(recovered.map(event=>event.action),['generate','generate']);
  assert.deepEqual(recovered.map(event=>event.sessionId),['project-session','project-session']);
});

test('workspace is driven by native tool results and bounded real output', () => {
  const source=(file)=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert.match(source('src/views/Chat.tsx'), /<LiveWorkspace update=\{liveWorkspace\}/);
  assert.match(source('src/engine/agent.ts'), /onToolDelta:/);
  assert.match(source('src-tauri/src/creator.rs'), /pub async fn run_project_check_stream/);
  assert.match(source('src/engine/creator.ts'), /new Channel<ProjectCheckOutput>/);
  assert.match(source('src/engine/agent.ts'), /events\.operation\(kind, resultStatus/);
});
