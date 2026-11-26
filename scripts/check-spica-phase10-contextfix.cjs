#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const script of ['scripts/check-spica-phase07.cjs','scripts/check-spica-phase10-roundE.cjs']){
  const result=spawnSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
