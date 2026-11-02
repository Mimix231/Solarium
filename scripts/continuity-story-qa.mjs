import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connectQa } from './native-qa-client.mjs';
const prose=await readFile('output/foundation-qa/daily-use-1793519617892/real-50k-chapter.md','utf8');
const importedBlock='```solarium-writing title="A Different Trajectory · inline QA"\n'+prose+'\n```';
const output=path.resolve('output/foundation-qa/story-continuity-'+Date.now());await mkdir(output,{recursive:true});
const client=await connectQa();
try{
  const result=await client.evaluate(`(async()=>{
    const {useSolarium}=await __qaImport('/src/state/useSolarium.ts');const {StoryRepository}=await __qaImport('/src/stories/repository.ts');const {WritingRepository}=await __qaImport('/src/writing/repository.ts');const {rememberStoryEvents}=await __qaImport('/src/stories/memory.ts');
    const state=useSolarium.getState(),spark=state.workspace.sparks.find(s=>s.name==='Dona')??state.workspace.sparks[0];const projectId=state.addProject('Story continuity acceptance','');const chatId=state.createSession(spark.id,projectId),messageId=crypto.randomUUID(),access={sessionId:chatId,projectId},scope={kind:'project',id:projectId};const stories=new StoryRepository(access),writing=new WritingRepository(access);
    const world=await stories.create('The Brass Key · native acceptance',scope);const mara=await stories.character(world.id,'Mara',[],'original'),ilya=await stories.character(world.id,'Ilya',[],'original');
    await stories.saveClaims(mara,[{characterId:mara.id,section:'Personality & Voice',field:'voice',value:'Plain speech; no boasting.',kind:'user_defined',locked:true,reviewed:true,sourceLinks:[]}],true);
    const fixture=await writing.create({scope,storyId:world.id,title:'Knowledge-state fixture',markdown:'Mara hid the brass key beneath the floor. Ilya was asleep outside.'});
    await rememberStoryEvents(stories,writing,fixture,[{summary:'Mara hid the key while Ilya was absent.',quote:'Mara hid the brass key beneath the floor.',knowledge:[{character:mara.id,state:'knows'},{character:ilya.id,state:'unknown'}]}]);
    const document=await writing.create({scope,storyId:world.id,title:'A Different Trajectory · inline QA',markdown:${JSON.stringify(prose)},messageId,legacyBlockId:'block-0'});
    state.updateSession(chatId,{storyId:world.id,mode:'creative'});state.appendMessage(chatId,{id:crypto.randomUUID(),role:'user',content:'Open the previously generated chapter for inline editing and story-memory acceptance.',createdAt:new Date().toISOString()});state.appendMessage(chatId,{id:messageId,role:'assistant',sparkId:spark.id,content:${JSON.stringify(importedBlock)},createdAt:new Date().toISOString()});useSolarium.setState({view:'chat'});
    globalThis.storyContinuityQa={access,documentId:document.id,storyId:world.id,maraId:mara.id,ilyaId:ilya.id,chatId,projectId,originalCharacters:Array.from(${JSON.stringify(prose)}).length};
    return{...storyContinuityQa,context:await stories.contextPack(world.id,'Write the next chapter.',true),documentCharacters:Array.from((await writing.get(document.id)).content.markdownProjection).length,importedPreviousRealModelArtifact:true};
  })()`);
  assert.ok(result.documentCharacters>=50000);assert.match(result.context,/Mara=knows/);assert.match(result.context,/Ilya=unknown/);assert.match(result.context,/Plain speech/);
  await writeFile(path.join(output,'initial.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output,...result}));
}finally{client.close();}
