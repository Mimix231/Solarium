#!/usr/bin/env node
/** Metadata-only warehouse scale benchmark. No synthetic executable blocks are advertised. */
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const entryArg=process.argv.indexOf('--entries');
const count=Number(entryArg<0?350000:process.argv[entryArg+1]);
if(!Number.isSafeInteger(count)||count<1||count>500000)throw Error('Specify --entries 1..500000');
const root=path.resolve(__dirname,'..');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-dce-index-bench-'));
(async()=>{
  try{
    cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--strict',
      '--skipLibCheck','--rootDir','src/spica/source','--outDir',path.join(temp,'lib'),
      ...['types.ts','validator.ts','registry.ts','loader.ts'].map(x=>'src/spica/source/'+x),
      ...['contracts.ts','indexer.ts','search.ts'].map(x=>'src/spica/source/intelligence/'+x)],
      {cwd:root,stdio:'pipe',timeout:120000});
    const {WarehouseIndexer}=require(path.join(temp,'lib/intelligence/indexer.js'));
    const {CapabilitySearchEngine}=require(path.join(temp,'lib/intelligence/search.js'));
    const disk=path.join(temp,'shards');fs.mkdirSync(disk);
    const start=performance.now();
    function* synthetic(){for(let i=0;i<count;i++)yield {
      id:`source.synthetic-${i}`,version:'1.0.0',kind:'knowledge-descriptor',category:i%2?'data':'gameplay',
      description:i===Math.floor(count/2)?'uniqueartemis movement prototype':'synthetic catalog descriptor',
      language:'typescript',targets:['typescript-web'],exports:[],requires:[],provenance:'documentation',
    };}
    const {manifest,shards}=await WarehouseIndexer.build(synthetic(),256);
    const builtAt=performance.now();
    for(const shard of shards)fs.writeFileSync(path.join(disk,shard.id+'.json'),JSON.stringify(shard));
    const engine=new CapabilitySearchEngine(manifest,{async readShard(id){
      return JSON.parse(await fs.promises.readFile(path.join(disk,id+'.json'),'utf8'));
    }});
    const result=await engine.search({query:'uniqueartemis',limit:10,maxShardReads:8});
    assert.equal(result.incomplete,false);
    assert.equal(result.matches.length,1);
    assert.equal(result.matches[0].capability.id,`source.synthetic-${Math.floor(count/2)}`);
    console.log(JSON.stringify({entries:count,shards:shards.length,buildMs:Math.round(builtAt-start),
      queryMs:Math.round(performance.now()-builtAt),shardsRead:result.shardsRead,
      sourceModules:0,descriptorEntries:count,heapUsedMB:Math.round(process.memoryUsage().heapUsed/1048576)},null,2));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
