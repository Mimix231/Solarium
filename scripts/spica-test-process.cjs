'use strict';
const {spawnSync}=require('node:child_process');

// Invoke the installed compiler with Node on every supported OS. A Windows
// .cmd shim cannot be spawned as an executable without an intervening shell.
exports.spawnSync=(command,args,options)=>{
  if(command==='tsc')return spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),...args],options);
  return spawnSync(command,args,options);
};
