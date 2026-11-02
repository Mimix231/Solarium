const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {sourceIdentity,writeSourceIdentity,isSourceInput}=require('../scripts/source-identity.cjs');

test('quality identity follows actual helper, native and test source bytes without hashing its generated output',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-source-identity-'));
 const put=(name,content)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),content);};
 try{
  put('src/helper.ts','export const one = 1;');put('src-tauri/src/action.rs','fn action() {}');put('tests/action.test.cjs','test source');put('package.json','{}');
  const first=writeSourceIdentity(root);assert.equal(first.sha256,sourceIdentity(root).sha256);assert.equal(first.files,4);
  put('src/quality/source-identity.generated.ts','irrelevant generated output');assert.equal(sourceIdentity(root).sha256,first.sha256);
  put('src/helper.ts','export const one = 2;');const helper=sourceIdentity(root).sha256;assert.notEqual(helper,first.sha256);
  put('src-tauri/src/action.rs','fn repaired_action() {}');const native=sourceIdentity(root).sha256;assert.notEqual(native,helper);
  put('tests/action.test.cjs','changed reference tests');assert.notEqual(sourceIdentity(root).sha256,native);
  assert.equal(isSourceInput(path.join(root,'src/helper.ts'),root),true);assert.equal(isSourceInput(path.join(root,'src/quality/source-identity.generated.ts'),root),false);
 }finally{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true});}
});
