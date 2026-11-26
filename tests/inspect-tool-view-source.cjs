'use strict';
/** Load the real inspection-view source into older isolated SPICA tool harnesses.
 * This is NOT a substitute implementation: tests execute the current TS file. */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const source=fs.readFileSync(path.join(root,'src/spica/inspect-tool-view.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleRecord={exports:{}};
new Function('require','module','exports',code)(()=>{throw Error('Inspection view source must have no runtime dependencies');},moduleRecord,moduleRecord.exports);
module.exports=moduleRecord.exports;
