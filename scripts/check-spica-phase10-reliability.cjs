#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const root=require('node:path').resolve(__dirname,'..');
const run=(bin,args)=>{const call=spawnSync(bin,args,{cwd:root,stdio:'inherit'});if(call.status!==0)process.exit(call.status??1);};
// Compile all runtime adapters, including every new one-file source, under
// strict TypeScript checking and run the real registered-tool contract suite.
run('node',['scripts/check-spica-phase07.cjs']);
// Validate actual persistence, permissioned runtime composition and plan UI.
run('node',['--test','tests/spica-phase10-capability-runtime.test.cjs','tests/spica-phase10-state-and-aliases.test.cjs']);
run('node',['scripts/check-spica-phase10.cjs']);
