'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const r=path.join(root,'src/spica/blocks');
const tree=path.join(root,'src/spica/runtime/blocks');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');

test('SPICA has one physical, category-based block source library',()=>{
  assert.equal(fs.existsSync(r),false,'src/spica/blocks must not remain a second source tree');
  const categories=fs.readdirSync(tree,{withFileTypes:true}).filter(p=>p.isDirectory()).map(p=>p.name);
  const found=[];
  const visit=folder=>{
    for(const item of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,item.name);
      if(item.isDirectory())visit(file);
      else if(item.name.endsWith('.ts'))found.push(file);
    }
  };
  for(const category of categories){const p=path.join(tree,category,'runtime');if(fs.existsSync(p))visit(p);}
  assert.equal(found.length,103,'all 103 individually executable V2 definitions must be in the unified tree');
  assert.equal(new Set(found.map(p=>path.relative(tree,p))).size,103);
  assert.ok(fs.existsSync(path.join(tree,'ui/runtime/components/ui-markdown-editor.ts')));
  const definitions=found.map(file=>fs.readFileSync(file,'utf8'));
  assert.ok(definitions.every(code=>code.includes('export default defineRuntimeBlock({')));
  const runtimeManifest=source('src/spica/runtime/registry.generated.ts');
  assert.equal((runtimeManifest.match(/^import adapter\d+ from '\.\/blocks\//gm)||[]).length,103);
  assert.doesNotMatch(runtimeManifest,/['"]\.\.\/blocks\//);
  const legacyManifest=source('src/spica/runtime/blocks/registry.generated.ts');
  assert.equal((legacyManifest.match(/"implementation"\s*:\s*\{/g)||[]).length,26);
  assert.ok(!legacyManifest.includes('/runtime/components/'),'legacy scanner must not claim executable V2 nodes');
});

test('unknown block IDs are actionable inspection errors, not terminal SPICA task failures',()=>{
  const agent=source('src/engine/agent.ts');
  const tools=source('src/spica/tools.ts');
  assert.match(agent,/if \(spica && resultStatus === 'failed'\)/);
  assert.doesNotMatch(agent,/if \(spica && resultStatus !== 'completed'\) break;/);
  assert.match(agent,/lastExecutedTool = 'invalid_spica_tool'/);
  assert.match(agent,/detail\.nextTool/);
  assert.match(agent,/validatedSpicaTool = null/);
  assert.match(tools,/last === 'invalid_spica_tool' \? \['inspect_solarium_tool','spica_next_action', 'inspect_spica_runtime_block'/);
  assert.match(agent,/if \(spica && resultStatus === 'denied'\) taskBlocked = true/,'denied permission must remain authoritative');
  assert.doesNotMatch(agent,/SPICA action stopped after a failed or denied tool call/);
});
