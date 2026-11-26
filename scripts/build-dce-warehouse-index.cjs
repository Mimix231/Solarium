#!/usr/bin/env node
/** Build a reviewed, metadata-only warehouse index. No source modules are executed. */
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const cp=require('node:child_process');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const argv=process.argv.slice(2);
const check=argv.includes('--check');
const outArg=argv.includes('--out')?argv[argv.indexOf('--out')+1]:'.dce-warehouse-index';
if(!outArg || outArg.startsWith('--'))throw Error('Missing --out path');
const output=path.resolve(root,outArg);
if(output===root||output===path.parse(root).root)throw Error('Refusing to write index to workspace root');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dce-index-compiler-'));
(async()=>{
  try{
    const files=[...['types','validator','registry','loader','builtins','generators','index'].map(x=>`src/spica/source/${x}.ts`),
      ...['contracts','indexer','search','dependencies','recipes','index'].map(x=>`src/spica/source/intelligence/${x}.ts`)];
    cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--strict',
      '--noUncheckedIndexedAccess','--skipLibCheck','--lib','ES2022,DOM',
      '--rootDir','src/spica/source','--outDir',temp,...files],{cwd:root,stdio:'pipe',timeout:60_000});
    const {createSourceBlockRegistry}=require(path.join(temp,'index.js'));
    const {WarehouseIndexer}=require(path.join(temp,'intelligence/indexer.js'));
    const {indexedCapability}=require(path.join(temp,'intelligence/contracts.js'));
    const {manifest,shards}=await WarehouseIndexer.build(createSourceBlockRegistry().list().map(indexedCapability),64);
    if(check){
      const actual=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
      assert.equal(JSON.stringify(actual),JSON.stringify(manifest),'Index manifest no longer matches registered source blocks');
      const shardDir=path.join(output,'shards');
      const actualNames=fs.readdirSync(shardDir).sort();
      const expected=shards.map(s=>s.id+'.json').sort();
      assert.deepEqual(actualNames,expected,'Warehouse shard list does not match the manifest');
      for(const shard of shards){
        const data=JSON.parse(fs.readFileSync(path.join(shardDir,shard.id+'.json'),'utf8'));
        assert.deepEqual(data,shard,`Changed warehouse shard ${shard.id}`);
      }
      console.log(`Warehouse index verified: ${manifest.count} entries across ${shards.length} shards.`);
    }else{
      // Never overwrite or delete an existing index or user data. Build a staged
      // directory on the same filesystem, then atomically promote it.
      if(fs.existsSync(output))throw Error(`Index directory already exists: ${output}; use --check or choose a new path`);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      const staging=fs.mkdtempSync(path.join(path.dirname(output),'.dce-index-staging-'));
      try{
        fs.mkdirSync(path.join(staging,'shards'));
        fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
        for(const shard of shards)fs.writeFileSync(path.join(staging,'shards',shard.id+'.json'),JSON.stringify(shard));
        fs.renameSync(staging,output);
      }finally{if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true,force:true});}
      console.log(`Wrote ${manifest.count} metadata records in ${shards.length} shards to ${output}`);
    }
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
