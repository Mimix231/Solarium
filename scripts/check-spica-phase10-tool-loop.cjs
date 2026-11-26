#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const args of [
  ['scripts/generate-spica-registry.cjs','--check'],
  ['scripts/generate-spica-runtime-registry.cjs','--check'],
  ['scripts/check-syntax.cjs'],
  ['scripts/check-spica-phase07.cjs'],
  ['scripts/check-spica-phase09.cjs'],
  ['scripts/check-spica-phase10-reliability.cjs'],
  ['scripts/check-spica-phase10-roundF.cjs'],
]) {
  const result=spawnSync('node',args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
