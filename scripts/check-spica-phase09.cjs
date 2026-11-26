#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const cwd=require('node:path').resolve(__dirname,'..');
for (const args of [
 ['scripts/generate-spica-registry.cjs','--check'],
 ['scripts/generate-spica-runtime-registry.cjs','--check'],
 ['scripts/check-syntax.cjs'],
 // The loop tests import the strictly compiled tool-intelligence module.
 // Build it here so Phase 09 is runnable from a clean checkout on its own.
 ['scripts/check-spica-phase07.cjs'],
 ['--test','tests/spica-phase09.test.cjs','tests/spica-phase09-loop.test.cjs'],
 ]) {
  const res=spawnSync('node',args,{cwd,stdio:'inherit'});
  if(res.status!==0)process.exit(res.status??1);
}
