'use strict';
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const compiled=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validator={exports:{}};
vm.runInNewContext(compiled('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({}),console});
const contract={exports:{}};
vm.runInNewContext(compiled('src/engine/intelligence/tool-contract-intelligence.ts'),{module:contract,exports:contract.exports,
  require:id=>id==='./tool-validation'?validator.exports:{},console});
module.exports=contract.exports;
