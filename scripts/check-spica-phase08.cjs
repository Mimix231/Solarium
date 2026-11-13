#!/usr/bin/env node
'use strict';
const {spawnSync}=require('child_process');
const root=require('path').resolve(__dirname,'..');
const commands=[
 ['node','scripts/generate-spica-registry.cjs','--check'],
 ['node','scripts/generate-spica-runtime-registry.cjs','--check'],
 ['node','scripts/check-syntax.cjs'],
 ['node','--test','tests/spica-phase08.test.cjs'],
];
for(const [program,...args] of commands){const result=spawnSync(program,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
