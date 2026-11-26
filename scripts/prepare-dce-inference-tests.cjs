'use strict';
/** Build the dependency-free inference subset for standalone context regression
 * tests. This does not compile the frontend or run/create an inference server. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
let ts;
try{ts=require('typescript');}
catch{
  try{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
  catch{throw new Error('Install the TypeScript compiler to run source-level inference tests: npm ci or npm install -g typescript');}
}
const root=path.resolve(__dirname,'..');
const sourceFiles=[
 'src/engine/capabilities.ts',
 'src/engine/reasoning.ts',
 'src/engine/sse.ts',
 'src/engine/llama.ts',
 'src/engine/backends.ts',
 'src/engine/context-window.ts',
 'src/engine/continuous-generation.ts',
 'src/engine/construction/decision-context.ts',
];
const dest=path.join(root,'.test-dist');
fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'package.json'),'\n{"type":"commonjs"}\n');
for(const rel of sourceFiles){
 const input=fs.readFileSync(path.join(root,rel),'utf8');
 const result=ts.transpileModule(input,{fileName:rel,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 if(result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error))throw new Error(`TypeScript transpilation failed for ${rel}`);
 const out=path.join(dest,rel.replace(/^src\//,'').replace(/\.ts$/,'.js'));
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,result.outputText);
}
console.log(`Prepared ${sourceFiles.length} dependency-free inference test modules`);
