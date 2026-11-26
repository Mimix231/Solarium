const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { deriveBrief, mentionedCast } = require('../.test-dist/engine/intelligence/brief.js');
const { applyFanfictionPreferences, isFanfictionChapter } = require('../.test-dist/writing/fiction.js');
const { formatSpeakerDialogue } = require('../.test-dist/writing/prose.js');
const { runLongWriting, unfinishedWriting, checkChapterLength } = require('../.test-dist/writing/long-task.js');
const { WritingRepository } = require('../.test-dist/writing/repository.js');
const { StoryRepository, profileClaimsAt } = require('../.test-dist/stories/repository.js');
const { saveFictionProfiles, statedFictionRules } = require('../.test-dist/stories/profiles.js');
const { ConversationResearch, relevantPagePassage } = require('../.test-dist/research/conversation.js');
const { SourceRepository, contentHash } = require('../.test-dist/sources/repository.js');
const { requestedCanonPoint, pageCanonPoint } = require('../.test-dist/stories/canon.js');
const { SpicaResearchRun } = require('../.test-dist/spica/research-run.js');
const { applySceneCorrections, removeEchoedSceneOpening, repeatedSceneCorrections, scenePassages } = require('../.test-dist/writing/acceptance.js');
const { fictionMentions, matchesCharacterMention } = require('../.test-dist/stories/mentions.js');
const { readFictionDossier, streamedFictionProfiles } = require('../.test-dist/stories/profile-preview.js');
const { FictionRepository, hasProfileDetail } = require('../.test-dist/stories/fiction.js');
const { englishFiction, englishFictionEvidence } = require('../.test-dist/stories/language.js');
const { activeCastFacts, castContinuityCorrections } = require('../.test-dist/writing/cast-continuity.js');
const { resolveFictionDestination } = require('../.test-dist/stories/destinations.js');
const { buildTaskContext } = require('../.test-dist/engine/intelligence/task.js');

class Store {
  entries = new Map();
  async list(filter) {
    return [...this.entries.values()].map(entry => entry.record).filter(record =>
      (!filter.collection || record.collection === filter.collection) && (!filter.storyId || record.storyId === filter.storyId) &&
      filter.scopes.some(scope => scope.kind === record.scope.kind && scope.id === record.scope.id)).map(record => structuredClone(record));
  }
  async body(id, scopes) {
    const entry = this.entries.get(id);
    return entry && scopes.some(scope => scope.kind === entry.record.scope.kind && scope.id === entry.record.scope.id) ? entry.body ?? null : null;
  }
  async batch(writes) {
    for (const write of writes) assert.equal(this.entries.get(write.record.id)?.record.version ?? null, write.expected);
    for (const write of writes) this.entries.set(write.record.id, { record: structuredClone(write.record), body: write.body ?? this.entries.get(write.record.id)?.body });
  }
}
const session = content => ({ id: 'fiction-test', mode: 'creative', messages: [{ id: 'user-request', role: 'user', content }] });
const owner = { kind: 'chat', id: 'fiction-test' };
const access = { sessionId: owner.id, projectId: null };

test('fanfiction gets an editable 82k default and dialogue labels; explicit limits and planning requests take precedence', () => {
  const request = 'Write chapter 1 of our fanfiction with Iona and Noor.';
  assert.equal(isFanfictionChapter(deriveBrief(session(request)), request), true);
  const makeBrief = text => applyFanfictionPreferences(deriveBrief(session(text)), text);
  assert.equal(makeBrief(request).target.minimum, 82_000);
  assert.match(makeBrief(request).dialogueFormat, /Name: dialogue/);
  assert.equal(makeBrief(request + ' Make the chapter longer than 80k characters.').target.minimum, 80_001);
  assert.equal(makeBrief(request + ' Use 2,300 characters.').target.minimum, 2300);
  assert.equal(makeBrief(request + ' No length target. Use traditional dialogue.').target, null);
  assert.equal(makeBrief(request + ' Use traditional dialogue.').dialogueFormat, '');
  const planning = 'Plan a fanfiction chapter we could write later.';
  assert.equal(isFanfictionChapter(deriveBrief(session(planning)), planning), false);
  const opening='Start a new English fanfiction chapter in one continuous scene.';
  assert.equal(isFanfictionChapter(deriveBrief(session(opening)),opening),true);
  assert.equal(deriveBrief(session('Create a character profile for my story.')).writingRequested,false);
});

test('speaker formatting preserves quotes, narration, and fenced material without inventing speakers', () => {
  const input = 'The light went out.\n**Iona:** “Wait.”\nNoor — I heard it too.\n\n“He will return,” she whispered.\n\n```text\nIona: literal sample\n```';
  const text = formatSpeakerDialogue(input, ['Iona', 'Noor']);
  assert.match(text, /The light went out\.\n\nIona: “Wait\.”\n\nNoor: I heard it too\./);
  assert.match(text, /“He will return,”\n\nShe whispered\./);
  assert.match(text, /```text\nIona: literal sample\n```/);
  assert.match(formatSpeakerDialogue(text, [], true), /\*\*Noor:\*\*/);
});

test('dialogue and narration occupy separate paragraphs in labeled and traditional layouts', () => {
  const mixed='“Where is the key?” the first guard asked. His lamp swung. “Look again.”\n\nIona put her book down. “Here,” she said. The sign read “Closed for the night.”';
  const text=formatSpeakerDialogue(mixed,['Iona']);
  assert.match(text,/The first guard: “Where is the key\?”\n\nThe first guard asked\. His lamp swung\.\n\nThe first guard: “Look again\.”/);
  assert.match(text,/Iona put her book down\.\n\nIona: “Here,”\n\nShe said\. The sign read “Closed for the night\.”/);
  const traditional=formatSpeakerDialogue(mixed,['Iona'],false,false);
  assert.match(traditional,/“Where is the key\?”\n\nThe first guard asked/);
  assert.doesNotMatch(traditional,/Iona: /);
});

test('saved character facts are individually recalled and catch a mismatched appearance and family role', () => {
  const cast=[
    { name:'Iona', aliases:[], fields:{appearance:'She has red hair and blue eyes.',relationships:'Her foster mother is Calla.',personality:'Wry and practical.'} },
    { name:'Noor', aliases:[], fields:{appearance:'She has silver hair and amber eyes.',history:'She worked on the ferry.'} },
  ];
  const context=activeCastFacts(cast,'Iona crosses the harbor');
  assert.match(context,/Iona[\s\S]*appearance: She has red hair and blue eyes\.[\s\S]*relationships: Her foster mother is Calla\./);
  assert.doesNotMatch(context,/Noor/);
  const draft='Iona stepped in with silver hair.\n\nNoor’s mother was Calla.\n\nIona looked at the guard with silver hair.\n\nNoor had silver hair.';
  const errors=castContinuityCorrections(draft,cast);
  assert.deepEqual(errors.map(error=>error.passage.text),['Iona stepped in with silver hair.','Noor’s mother was Calla.']);
  assert.match(errors[0].reason,/red hair/);
  assert.match(errors[1].reason,/Iona’s mother/);
  const intentional=castContinuityCorrections(draft,cast,'In this AU, Iona has silver hair. Noor’s mother was Calla.');
  assert.deepEqual(intentional,[]);
});

test('a character mention can start an actual dossier and incomplete tool text renders only its own sections', () => {
  assert.deepEqual(fictionMentions('Iona Marrow',[],false),{names:['Iona Marrow'],nameOnly:true});
  assert.deepEqual(fictionMentions('Arc 2, Iona and Noor',[],true),{names:['Iona','Noor'],nameOnly:true});
  assert.deepEqual(fictionMentions('Iona, Noor, Lani and Rail',[],true),{names:['Iona','Noor','Lani','Rail'],nameOnly:true});
  assert.deepEqual(fictionMentions('Keep Iona, Noor, Lani, and Rail in this chapter.',[],true).names,['Iona','Noor','Lani','Rail']);
  assert.equal(matchesCharacterMention('Iona, Noor and Lani',[],['Iona','Noor','Lani']),false);
  assert.deepEqual(fictionMentions('Could you explain this arc?',[],false).names,[]);
  assert.deepEqual(fictionMentions('Bring the scene to the harbor and introduce Iona Marrow tomorrow.',[],true).names,['Iona Marrow']);
  assert.equal(matchesCharacterMention('Iona Marrow',['Iona'],['Iona']),true);
  assert.equal(matchesCharacterMention('Another Marrow',[],['Iona Marrow']),false);
  assert.equal(hasProfileDetail('(Draft: Appearance is yet to be defined.)'),false);
  assert.equal(hasProfileDetail('(Based on canon character introduction for Arc 1.)'),false);
  assert.equal(hasProfileDetail('She has no formal training and finds the ferry markers by touch.'),true);
  const partial = '{"profiles":[{"name":"Iona","kind":"adapted","sections":{"appearance":"Raincoat","personality":"Dry and\\u00';
  assert.deepEqual(streamedFictionProfiles(partial),[{name:'Iona',sections:{appearance:'Raincoat',personality:'Dry and'}}]);
  const full=JSON.stringify({profiles:[
    {name:'Iona',sections:{personality:'Practical',appearance:'Raincoat',history:'Runs the ferry',abilities:'Reads the charts'},
      evidence:[{quote:'"name": "Not a cast member"'}]},
    {name:'Noor',sections:{voice:'Plainspoken'}},
  ]});
  assert.deepEqual(streamedFictionProfiles(full),[{name:'Iona',sections:{personality:'Practical',appearance:'Raincoat',history:'Runs the ferry',abilities:'Reads the charts'}},
    {name:'Noor',sections:{voice:'Plainspoken'}}]);
});

test('readable character dossiers keep their streamed sections and evidence with the named character', () => {
  const opening = '## Profile: Iona\n### Personality\nValues promises above comfort.\n';
  assert.deepEqual(readFictionDossier(opening, ['Iona', 'Noor']), [
    { name:'Iona', sections:{personality:'Values promises above comfort.'}, evidence:[] },
  ]);
  const complete = opening + '### Appearance\nWears a salt-stained coat.\n**History:** Took over the ferry.\n' +
    'Abilities: Reads tide tables.\nEvidence: abilities | source-1 | Reads the daily tide tables.\n' +
    '## Profile: Noor\n### Personality\nSnaps when nervous.\nWorld rule: The keeper guards the sluice.';
  assert.deepEqual(readFictionDossier(complete, ['Iona', 'Noor']), [
    { name:'Iona', sections:{personality:'Values promises above comfort.', appearance:'Wears a salt-stained coat.',
      history:'Took over the ferry.', abilities:'Reads tide tables.'},
      evidence:[{field:'abilities',source_id:'source-1',quote:'Reads the daily tide tables.'}] },
    { name:'Noor', sections:{personality:'Snaps when nervous.'}, evidence:[] },
  ]);
});

test('explicit user restrictions carry their exact attribution into the profile save', () => {
  const text='Iona cannot disclose the keeper’s name. Noor remains unaware until Iona tells her. Draft the first encounter.';
  assert.deepEqual(statedFictionRules(text,'user-request'),[
    {quote:'Iona cannot disclose the keeper’s name.',messageId:'user-request'},
    {quote:'Noor remains unaware until Iona tells her.',messageId:'user-request'},
  ]);
  assert.deepEqual(statedFictionRules('Do not save story rules. Iona must not reveal the route.','user-request'),[]);
});

test('English dossiers use a real translation operation and replace generated foreign text through a new revision', async () => {
  const quote='港の近くで育った。';
  const request='Write an English character profile for Iona.';
  const translated='Iona grew up near the harbor.';
  const adapter={kind:'llama.cpp',countTokens:async()=>150,async generate(model,messages,capabilities,callbacks,signal,config){
    assert.equal(config.outputTokens,-1);
    assert.ok(messages.find(message=>message.role==='user').content.includes(request));
    assert.ok(messages.some(message=>message.content.includes(quote)));
    callbacks.answer(translated);
    return {answer:translated,calls:[],finishReason:'stop'};
  }};
  assert.equal(englishFiction(request),true);
  assert.equal(englishFiction('Write the profile in Japanese.'),false);
  assert.equal(await englishFictionEvidence({adapter,model:{contextSize:4096},capabilities:{},
    signal:new AbortController().signal,onReasoning(){}},'You are a Spark.',request,quote,'Focus on Iona.'),translated);
  const store=new Store(), stories=new StoryRepository(access,store), fiction=new FictionRepository(stories);
  const world=await stories.create('River Republic',owner);
  const category=await fiction.saveCategory(world.id,'Harbor',{});
  const selection={categoryId:category.id,characterIds:[]};
  const destination={storyId:world.id,categoryId:category.id};
  const proposals=history=>({profiles:[{name:'Iona',kind:'adapted',sections:{history}}]});
  await saveFictionProfiles(stories,owner,world.id,selection,proposals(quote),undefined,[],false,destination);
  const [oldCard]=await fiction.profiles(world.id,category.id);
  assert.deepEqual(await fiction.untranslatedGeneratedFields(oldCard),{history:quote});
  await assert.rejects(saveFictionProfiles(stories,owner,world.id,selection,proposals(quote),undefined,[],false,destination,true),/Translate Iona/);
  await saveFictionProfiles(stories,owner,world.id,selection,proposals(translated),undefined,[],false,destination,true);
  const [card]=await fiction.profiles(world.id,category.id);
  assert.equal(card.version,2);
  assert.equal((await fiction.read(card)).history,translated);
  assert.deepEqual(await fiction.untranslatedGeneratedFields(card),{});
  assert.equal((await store.list({collection:'story_profile_revision',scopes:[owner]})).length,1);
});

test('compact cast and saved web passages survive chapter turns while profile summaries preserve user facts', async () => {
  const store = new Store(), stories = new StoryRepository(access, store), sources = new SourceRepository(access, store);
  const world = await stories.create('River Republic AU', owner, { originKind: 'fanfiction', franchiseName: 'River Republic', canonAnchor: 'light novel', spoilerArc: 2 });
  const iona = await stories.character(world.id, 'Iona');
  await stories.saveClaims(iona, [{ characterId: iona.id, field: 'voice', section:'Personality & Voice', value:'Quiet, deliberate and restrained.', kind:'user_defined', locked:true, reviewed:true, sourceLinks:[] }], true);
  const quote = 'Iona carries a cracked brass compass.';
  const source = await sources.create({ scope: owner, kind: 'webpage', title: 'River Republic light novel arc 2',
    origin: { kind:'web', url:'https://example.test/arc-2', accessedAt:'2026-11-20', readState:'read' }, content: quote, arc: 2, continuity: 'light novel' });
  const input = { profiles: [{ name:'Iona', kind:'adapted', sections:{voice:'A prankster.', appearance:'Carries a battered compass.', abilities:'Reads the old river charts.'},
    evidence:[{field:'appearance',source_id:source.id,quote}]}, { name:'Noor',kind:'original',sections:{voice:'Dry and formal.',knowledge:'Has never seen Iona use the compass.'}}] };
  const saved = await saveFictionProfiles(stories, owner, world.id, null, input);
  assert.deepEqual(saved.profiles[0].preserved, ['voice']);
  const all = await stories.claims(iona.id, world.id);
  assert.equal(all.find(claim => claim.data.field === 'voice').data.value, 'Quiet, deliberate and restrained.');
  assert.equal(all.find(claim => claim.data.field === 'appearance').data.kind, 'source_supported');
  assert.equal(all.find(claim => claim.data.field === 'abilities').data.profileDraft, true);
  assert.match(await stories.contextPack(world.id, 'Chapter 2', true), /Quiet, deliberate[\s\S]*Dry and formal/);
  const research = new ConversationResearch({}, owner, owner.id, 'Write the next chapter', null, sources,
    { title:'River Republic',arc:2,continuity:'light novel' });
  await research.recall((await stories.world(world.id)).data.sourceIds);
  assert.deepEqual(research.sourceIds, [source.id]);
  assert.match(research.context, /cracked brass compass/);
  const rejected = { profiles: [{ name:'Unverified',kind:'canon',sections:{history:'Invented'},evidence:[{field:'history',source_id:source.id,quote:'This was never on the page.'}]}] };
  await assert.rejects(saveFictionProfiles(stories, owner, world.id, null, rejected), /exact supporting passage/);
  assert.equal((await stories.characters(world.id)).length, 2);
  const later = new ConversationResearch({}, owner, owner.id, 'Changed arc', null, sources, {title:'River Republic',arc:1,continuity:'light novel'});
  await later.recall([source.id]);
  assert.equal(later.hasEvidence, false);
});

test('82k chapter requires a saved ending, adds advancing scenes after short natural stops, and retains a single document', async () => {
  const store = new Store(), prefs = defaultWorkspace(), chat = session('Write a fanfiction chapter of 82,000 characters with Iona and Noor.');
  const brief = applyFanfictionPreferences(deriveBrief(chat), chat.messages[0].content);
  const proofLabels = new Set();
  let calls = 0, expansions = 0, visible = '', report, planningAttempts=0, recoveredPlan=false;
  const scenes = (prefix, count) => Array.from({ length:count }, (_, i) => ({
    title: `${prefix} ${i + 1}`, purpose: `Finish ${prefix} action ${i + 1}`, stateAfter: `${prefix} result ${i + 1}`, }));
  const adapter = { kind:'llama.cpp',countTokens:async()=>650,async generate(model,messages,capabilities,callbacks,signal,config) {
    assert.equal(config.outputTokens, -1);
    assert.equal(messages.filter(message => message.role === 'user').length, 1);
    const prompt = messages.at(-1).content;
    assert.ok(prompt.includes(chat.messages[0].content));
    let answer;
    if (prompt.includes('Create a compact JSON scene plan')) {
      if(++planningAttempts===1){
        callbacks.answer('{"title":"Unfinished plan"');
        return {answer:'{"title":"Unfinished plan"',calls:[],finishReason:'length'};
      }
      assert.match(prompt,/Return the required JSON now/);
      answer = JSON.stringify({ title:'A Different River',facts:[],scenes:scenes('Movement',4) });
    } else if (prompt.includes('Plan about') && prompt.includes('BEFORE the reserved conclusion')) {
      expansions++;
      answer = JSON.stringify({title:'Development',facts:[],scenes:scenes(`Additional movement ${expansions}`,4)});
    } else {
      const label = /"beatId":"(scene-\d+)"/.exec(prompt)?.[1];
      assert.ok(label);
      assert.equal(proofLabels.has(label), false);
      proofLabels.add(label);
      const ending = `Iona reached the promised mooring with token ${calls}.`;
      const segments = Array.from({ length:9 }, (_, p) => Array.from({length:67}, (_, i) => `detail${calls}p${p}w${i}`).join(' ')).join('\n\n');
      answer = `**Iona:** Stay by the mooring.\nNoor: I will.\n\n${segments}\n\n${ending}<solarium-scene>${JSON.stringify({beatId:label,quote:ending,endState:ending})}</solarium-scene>`;
    }
    calls++;
    assert.ok(calls < 35,'Accepted short scenes must not loop indefinitely');
    for (const chunk of answer.match(/.{1,301}|\n/gu)) callbacks.answer(chunk);
    return {answer,calls:[],finishReason:'stop'};
  }};
  const opts = {spark:prefs.sparks[0],model:{backend:'llama.cpp',contextSize:8192},session:chat,preferences:prefs.preferences,
    memories:[],fanfictionChapter:true,messageId:'answer',signal:new AbortController().signal,events:{emit(){}},onApproval:async()=> 'allow',
    onAnswer:delta=>{visible+=delta;},onAnswerReplace:text=>{visible=text;},onWritingTask:progress=>{
      report=progress;recoveredPlan||=progress.interlude?.operation==='plan';
    } };
  await runLongWriting(opts,adapter,{},'',null,store,brief);
  const repo = new WritingRepository(access,store),docs = await repo.list();
  assert.equal(docs.length,1);
  const { document, content } = await repo.get(docs[0].id);
  assert.equal(report.state,'completed');
  assert.equal(recoveredPlan,true);
  assert.equal(document.data.status,'final');
  assert.equal(document.data.metadata.dialogueLayout,'speaker');
  assert.ok(checkChapterLength(content.markdownProjection,brief.target).complete);
  assert.ok(expansions>0);
  assert.equal(await unfinishedWriting(repo,chat.id,document.id),null);
  assert.match(content.markdownProjection,/Iona: Stay by the mooring\.\n\nNoor:/);
  assert.equal(content.markdownProjection.includes('solarium-scene'),false);
  assert.equal((visible.match(/```solarium-writing/g)??[]).length,1);
});

test('canon coordinates and edition scope select distinct cast profiles and exclude later private knowledge', async () => {
  const store = new Store(), stories = new StoryRepository(access, store);
  const world = await stories.create('River Republic AU', owner, { originKind:'fanfiction', franchiseName:'River Republic', canonAnchor:'web novel' });
  const early = requestedCanonPoint('Write a fanfic based on Arc 1, Chapter 1 of the web novel.');
  const later = requestedCanonPoint('Pick up at chapter 4 of arc 2.', early);
  assert.deepEqual(requestedCanonPoint('Write chapter 3 of my adaptation.', early), early);
  assert.deepEqual(pageCanonPoint('作家の物語　第一章１', '', 'https://example.test/2/'), {arc:1,chapter:1,continuity:undefined});
  assert.deepEqual(mentionedCast('Cast: Arc 1 Iona, Noor, Lani and Rail.'), ['Iona','Noor','Lani','Rail']);
  const quote = 'The witness cannot disclose what opened the sluice.';
  await saveFictionProfiles(stories, owner, world.id, null, { profiles:[{name:'Iona',kind:'adapted',sections:{voice:'Quiet and cautious.',knowledge:'Has never seen the opened sluice.'}}] }, early, [{quote,messageId:'user-request'}]);
  await saveFictionProfiles(stories, owner, world.id, null, { profiles:[{name:'Iona',kind:'adapted',sections:{voice:'Direct and experienced.',knowledge:'Learned the sluice code from Rail.'}}] }, later);
  await saveFictionProfiles(stories, owner, world.id, null, { profiles:[{name:'Iona',kind:'adapted',sections:{voice:'Anime voice.',knowledge:'An anime-only scene.'}}] }, {...early,continuity:'anime'});
  const iona = (await stories.characters(world.id))[0];
  const claims = await stories.claims(iona.id, world.id);
  assert.equal(claims.length, 6);
  assert.equal(profileClaimsAt(claims, early).find(claim=>claim.data.field==='voice').data.value, 'Quiet and cautious.');
  assert.equal(profileClaimsAt(claims, later).find(claim=>claim.data.field==='voice').data.value, 'Direct and experienced.');
  const pack = await stories.contextPack(world.id, 'Write with Iona', true, null, early);
  assert.match(pack, /Quiet and cautious/);
  assert.ok(pack.includes(quote));
  assert.doesNotMatch(pack, /Learned the sluice code|Anime voice/);
});

test('exact episode evidence follows an observed localized chapter link and recalls series context with Web OFF', async () => {
  const store=new Store(), sources=new SourceRepository(access,store), signal=new AbortController().signal;
  const index='https://example.test/story/', chapter=index+'2/', future=index+'11/';
  const pages=new Map([
    [index,{title:'River Republic',text:'Citizens of the River Republic manage its water through sealed sluices.',
      links:[{url:future,title:'第二章１'},{url:chapter,title:'第一章１'}]}],
    [chapter,{title:'物語　第一章１',text:'Iona saw the sluice gate for the first time.'}],
    [future,{title:'River Republic Arc 2 Chapter 1',text:'Iona knew the hidden passage in the old sluice.'}],
  ]);
  let enabled=true, reads=0;
  const runner=()=>new SpicaResearchRun(()=>({search:async()=>[],kind:'bing',
    read:async url=>{reads++;const page=pages.get(url);return {...page,url,locator:page.title,retrievedAt:'2026-11-20',contentHash:await contentHash(page.text)};},
  }),()=>enabled);
  const boundary={title:'River Republic',arc:1,chapter:1,continuity:'web novel',wantOverview:true};
  const request='Write Arc 1 Chapter 1 from [overview]('+index+'), using no later arc '+future;
  const research=new ConversationResearch(runner(),owner,owner.id,request,null,sources,boundary);
  assert.deepEqual(research.remainingReferences,[index,future]);
  const wrong=await research.read({url:future},signal);
  assert.equal(wrong.relevance,'weak');
  assert.deepEqual(research.remainingReferences,[index]);
  await assert.rejects(research.read({url:future},signal),/already read/);
  const overview=await research.read({url:index,reference:'overview'},signal);
  assert.deepEqual(research.remainingReferences,[]);
  assert.equal(research.readyForChapter,false);
  const observed=overview.references.find(link=>link.point.arc===1&&link.point.chapter===1);
  assert.ok(observed);
  const actual=await research.read({source_id:observed.id},signal);
  assert.equal(actual.evidenceRole,'chapter');
  assert.equal(research.readyForChapter,true);
  assert.equal((await sources.get(actual.sourceId)).source.data.chapter,1);
  enabled=false;
  const recovered=new ConversationResearch(runner(),owner,owner.id,request,null,sources,boundary);
  await recovered.recall(research.sourceIds);
  assert.equal(recovered.readyForChapter,true);
  assert.match(recovered.context,/first time/);
  assert.doesNotMatch(recovered.context,/hidden passage/);
  assert.equal(reads,3);
});

test('chapter evidence retains the end of a long page and an echoed opening does not lose newly written prose', () => {
  const opening = 'The ferry reached the upstream landing just after sunrise.';
  const closing = 'Noor handed the brass key to Iona behind the baker’s stall.';
  const page = [opening,...Array.from({length:35},(_,i)=>'The ferry schedule described ordinary river travel around pier '+(i+1)+'. '.repeat(15)),closing].join('\n\n');
  const excerpt = relevantPagePassage(page,'ferry schedule','chapter');
  assert.ok(excerpt.includes(opening)&&excerpt.includes(closing));
  const echo = 'The dam technician checked the narrow walkway, read the warning on the bronze gate and counted the three brass marks along its rim before she made a note for the quiet official waiting on the other side.';
  const next = 'Iona slid the key under the flap of the note.';
  assert.equal(removeEchoedSceneOpening(echo+'\n\n'+next,opening+'\n\n'+echo),next);
  assert.equal(removeEchoedSceneOpening(echo,echo),echo);
  assert.equal(repeatedSceneCorrections(next+'\n\n'+echo,echo)[0].passage.text,echo);
});

test('a continued scene retains its earlier outcome evidence and can repair either side of its checkpoint', () => {
  const old='Iona lowered the brass gate.';
  const next='Noor followed from the landing.';
  const whole=old+'\n\n'+next;
  const passages=scenePassages(whole,1000);
  const change='Iona lowered the iron gate.';
  const revised=applySceneCorrections(whole,JSON.stringify({replacements:[{passage:1,text:change}]}),
    [{passage:passages[0],reason:'The gate is iron.'}],old.length+2);
  assert.equal(revised.text.slice(0,revised.boundary),change+'\n\n');
  assert.equal(revised.text.slice(revised.boundary),next);
  const lengthy=old+'\n\n'+('The morning market brought merchants from two nearby villages.\n\n').repeat(70)+next;
  const reviewed=scenePassages(lengthy,1200,[old]).map(passage=>passage.text);
  assert.ok(reviewed.includes(old)&&reviewed.includes(next));
});

test('automated profile drafts can fill an old placeholder while user text stays protected', async () => {
  const store=new Store(), stories=new StoryRepository(access,store);
  const world=await stories.create('River Republic',owner,{originKind:'fanfiction'});
  const character=await stories.character(world.id,'Iona',[],'adapted');
  await stories.saveClaims(character,[{characterId:character.id,section:'Personality & Voice',field:'personality',
    value:'(Draft: Personality is yet to be defined.)',kind:'interpretation',profileDraft:true,locked:false,reviewed:false,sourceLinks:[]}]);
  assert.equal(profileClaimsAt(await stories.claims(character.id,world.id),{}).length,0);
  await saveFictionProfiles(stories,owner,world.id,null,{profiles:[{name:'Iona',kind:'adapted',sections:{
    personality:'Iona waits for the other person to finish speaking before she offers precise practical help.',
    history:'To be determined.',
  }}]});
  const active=profileClaimsAt(await stories.claims(character.id,world.id),{});
  assert.equal(active.length,1);
  assert.match(active[0].data.value,/precise practical help/);
  assert.equal((await stories.characters(world.id))[0].id,character.id);
});

test('a named personal group and category get the actual profile and preserve independently written fields', async () => {
  const store=new Store(), stories=new StoryRepository(access,store), fiction=new FictionRepository(stories);
  const personal={kind:'library',id:'personal'};
  const group=await stories.create('River Republic',personal,{originKind:'fanfiction',franchiseName:'River Republic'});
  const brief='A ferry crew protects its town during hard winters. Humor and closeness grow from the way the crew works together.';
  const edited=await stories.update(group,{storyBrief:brief});
  assert.equal((await stories.world(edited.id)).data.storyBrief,brief);
  assert.match(await stories.contextPack(edited.id,'Write a winter chapter.',true),/Author’s story brief\nA ferry crew protects its town/);
  const duplicate=await stories.create('River Republic',owner);
  await fiction.saveCategory(duplicate.id,'Different arc',{arc:2});
  const category=await fiction.saveCategory(group.id,'First Landing',{arc:1,continuity:'web novel'});
  const character=await stories.character(group.id,'Iona');
  await fiction.saveProfile(group.id,category.id,character.id,{personality:'She gives people time to answer.'},null);
  const chosen=await resolveFictionDestination(stories,'Iona to [river republic > First Landing]');
  assert.equal(chosen.request,'Iona');
  assert.equal(chosen.explicit,true);
  assert.deepEqual(chosen.destination,{storyId:group.id,categoryId:category.id});
  await assert.rejects(resolveFictionDestination(stories,'[River Republic > Missing]'),/could not be found/);
  await assert.rejects(saveFictionProfiles(stories,owner,group.id,{categoryId:category.id,characterIds:[]},
    {profiles:[{name:'Iona, Noor and Lani',kind:'adapted',sections:{personality:'Combined draft.'}}]},
    undefined,[],false,chosen.destination),/one profile per character/);
  assert.equal((await stories.characters(group.id)).length,1);
  const saved=await saveFictionProfiles(stories,owner,group.id,{categoryId:category.id,characterIds:[]},
    {profiles:[{name:'Iona',kind:'adapted',sections:{personality:'She interrupts constantly.',appearance:'She wears a bright coat when crossing the river.',abilities:'She reads depth markers in low light.'}}]},
    undefined,[],false,chosen.destination);
  assert.equal(saved.destination.group,group.title);
  assert.equal(saved.destination.category,category.title);
  const profiles=await fiction.profiles(group.id,category.id);
  assert.equal(profiles[0].id,saved.profiles[0].profileId);
  assert.deepEqual((await fiction.read(profiles[0])),{personality:'She gives people time to answer.',
    appearance:'She wears a bright coat when crossing the river.',abilities:'She reads depth markers in low light.'});
  assert.deepEqual(profiles[0].data.generatedFields,['appearance','abilities']);
  assert.equal((await stories.list()).length,2);
  assert.equal((await stories.characters(duplicate.id)).length,0);
});

test('an unrelated search response supplies a fallback action and can never become a readable candidate', async () => {
  const wrong='https://example.test/irrelevant', good='https://example.test/sluice';
  const signal=new AbortController().signal;
  const runner=new SpicaResearchRun(async()=>({
    kind:'bing',fallbackKind:'mwmbl',search:async()=>[{url:wrong,title:'A fashion forum',excerpt:'Summer break.'}],
    fallbackSearch:async()=>[{url:good,title:'River Republic sluice keeper',excerpt:'The sluice keeper of the River Republic'}],
    read:async url=>({url,title:'River Republic sluice keeper',text:'The River Republic sluice keeper tracks water levels.',
      contentHash:'test',locator:'Ledger',retrievedAt:'2026-11-21'}),
  }),()=>true);
  const research=new ConversationResearch(runner,owner,owner.id,'Read about the sluice keeper',null,null);
  const query='River Republic sluice keeper';
  const first=await research.search(query,signal);
  assert.equal(first.relevance,'weak');
  assert.deepEqual(first.results,[]);
  assert.deepEqual(first.next.arguments,{query,fallback:true});
  await assert.rejects(research.read({url:wrong},signal),/current search results/);
  const next=await research.search(query,signal,true);
  assert.equal(next.relevance,'matched');
  assert.equal(next.provider,'mwmbl');
  assert.equal(next.results[0].url,good);
  assert.equal((await research.read({source_id:next.results[0].id,url:good},signal)).relevance,'matched');
});

test('provider failures retain their diagnostic and the Spark can choose the offered fallback', async () => {
  let fallbackCalls=0;
  const signal=new AbortController().signal;
  const query='guide for turbine inspection checklist';
  const shorter='turbine inspection checklist';
  const provider=new SpicaResearchRun(async()=>({kind:'bing',fallbackKind:'mwmbl',
    search:async()=>{throw Error('Search service unavailable');},
    fallbackSearch:async input=>{fallbackCalls++;return input===shorter?[{title:'Turbine inspection checklist',url:'https://example.test/inspection'}]:[];},
    read:async url=>({url,title:'Maintenance index',text:['Turbine troubleshooting', 'Inspection regulations', 'Checklist templates']
      .join('\n\n'+'Archived links. '.repeat(90)+'\n\n'),contentHash:'index',locator:'Maintenance',retrievedAt:'2026-11-21'}),
  }),()=>true);
  const research=new ConversationResearch(provider,owner,owner.id,'Find the inspection checklist online.',null,null);
  const failed=await research.search(query,signal);
  assert.match(failed.attempts[0].diagnostic,/Search service unavailable/);
  assert.deepEqual(failed.next.arguments,{query,fallback:true});
  assert.equal(fallbackCalls,0);
  const recovered=await research.search(query,signal,true);
  assert.equal(recovered.provider,'mwmbl');
  assert.equal(recovered.attempts[0].query,shorter);
  assert.equal(fallbackCalls,1);
  assert.equal((await research.read({source_id:recovered.results[0].id},signal)).relevance,'weak');
  assert.equal(research.hasEvidence,false);
});

test('a new web topic recalls relevant saved evidence without borrowing the preceding fiction topic', async () => {
  const store=new Store(), repo=new SourceRepository(access,store);
  await repo.create({scope:owner,title:'Iona at the landing',kind:'webpage',content:'Iona guarded the brass key at the river landing.',
    origin:{kind:'web',url:'https://example.test/iona',accessedAt:'2026-11-21',readState:'read'}});
  const useful=await repo.create({scope:owner,title:'Turbine bearing lubrication',kind:'webpage',
    content:'Turbine bearing lubrication starts with the lubricant grade and bearing temperature.',
    origin:{kind:'web',url:'https://example.test/lubrication',accessedAt:'2026-11-21',readState:'read'}});
  const chat=session('Discuss Iona at the river landing and her brass key.');
  chat.messages.push({id:'online',role:'user',content:'Search the web for turbine bearing lubrication.'});
  const context=await buildTaskContext(chat,undefined,store);
  assert.deepEqual(context.savedWebIds,[useful.id]);
  assert.match(context.context,/Turbine bearing lubrication/);
  assert.doesNotMatch(context.context,/Iona|brass key/);
});

test('capacity checkpoints resume the same scene, apply an exact live correction, and accept outcome evidence from the actual prose', async () => {
  const store=new Store(), prefs=defaultWorkspace(), repository=new WritingRepository(access,store), stories=new StoryRepository(access,store);
  const world=await stories.create('River Republic AU',owner,{originKind:'fanfiction'});
  const iona=await stories.character(world.id,'Iona');
  await stories.saveClaims(iona,[{characterId:iona.id,field:'constraints',section:'AU Changes',
    value:'She waits at a respectful distance from frightened neighbors.',kind:'user_defined',locked:true,reviewed:true,sourceLinks:[]}],true);
  const chat={...session('Write a fanfiction chapter of 360 characters about Iona opening the sluice.'),storyId:world.id};
  const brief=applyFanfictionPreferences(deriveBrief(chat),chat.messages[0].content);
  const unchanged='The notice was still tucked behind the shut window, where the rain could not reach it.';
  const wrong='Iona leaned against the wall with predatory stillness.';
  const fixed='Iona set her umbrella beside the door and waited on the far side of the landing.';
  const complete='Iona opened the sluice and the last of the high water emptied into the stone channel.';
  const next='Iona takes the agreed key and opens the sluice.';
  const stages=[],warnings=[]; let draft='',first=true,requestedPassageAgain=false;
  const adapter={kind:'llama.cpp',countTokens:async()=>400,async generate(_model,messages,_caps,callbacks,_signal,config){
    assert.equal(config.outputTokens,-1);
    assert.equal(messages.filter(message=>message.role==='user').length,1);
    const prompt=messages.at(-1).content;
    let answer,finishReason='stop';
    const locate=(text)=>Number(prompt.split('\n').find(line=>line.startsWith('[')&&line.includes(text))?.match(/^\[(\d+)\]/)?.[1]);
    if(prompt.includes('Create a compact JSON scene plan')){
      answer=JSON.stringify({title:'The Sluice',facts:[],scenes:[{title:'Landing',purpose:'Open the sluice.',stateAfter:complete}]});
    } else if(prompt.includes('REPAIR EXACT DRAFT PASSAGES')){
      answer=JSON.stringify({replacements:[{passage:locate(wrong),text:fixed}]});
    } else if(prompt.includes('CHECK THE DRAFTED SCENE')){
      if (prompt.includes(wrong)) answer=JSON.stringify({outcome:null,issues:[{passage:locate(wrong),reason:'She respects the frightened neighbors.'}]});
      else if (prompt.split('DRAFT EXCERPTS IN ORDER:').at(-1).includes(complete)){
        assert.ok(prompt.split('DRAFT EXCERPTS IN ORDER:').at(-1).includes(unchanged));
        requestedPassageAgain=prompt.includes('The previous assessment did not identify a usable passage.');
        answer=JSON.stringify({outcome:requestedPassageAgain?locate(complete):'The sluice opened.',stateAfter:complete,issues:[]});
      }
      else answer=JSON.stringify({outcome:null,issues:[],memories:[{passage:locate(unchanged),change:'The notice stays dry.',knowledge:[{character:'Iona',state:'unknown'}]}],nextBeat:next});
    } else if(first){
      first=false;
      answer=wrong+'\n\n'+unchanged+'\n\nThe key was somewhere in\n<solarium-memory>[{"summary":"partial';
      finishReason='length';
    } else {
      assert.match(prompt,/Continue within this same scene/);
      assert.ok(prompt.includes(unchanged)&&prompt.includes(next)&&prompt.includes('The notice stays dry.'));
      assert.match(prompt,/interrupted clause if present: The key was somewhere in/);
      answer='Noor pointed out the tin cup beside the neighboring doorway. When she saw the key nestled in the bottom, she carried it downstairs and found the old keyway by touch.\n\n'+complete;
    }
    callbacks.answer(answer);
    return {answer,calls:[],finishReason};
  }};
  const stop=new AbortController();
  const options={spark:prefs.sparks[0],model:{backend:'llama.cpp',contextSize:8192},session:chat,preferences:prefs.preferences,
    memories:[],fanfictionChapter:true,messageId:'first',signal:stop.signal,events:{emit(){}},onApproval:async()=>'allow',
    onAnswer:delta=>{draft+=delta;},onAnswerReplace:text=>{draft=text;},onWarning:warning=>warnings.push(warning),onWritingTask:progress=>{
      const stage=progress.interlude?.stage;
      if(stage)stages.push(stage);
      if(stage==='ready')stop.abort();
    }};
  await assert.rejects(runLongWriting(options,adapter,{},'',null,store,brief),{name:'AbortError'});
  assert.equal(draft.trimEnd().endsWith('```'),false);
  const [document]=await repository.list();
  const paused=await unfinishedWriting(repository,chat.id,document.id);
  assert.equal(paused.data.nextScene,0);
  assert.equal(paused.data.pendingScene.nextBeat,next);
  assert.deepEqual(stages.filter((stage,i)=>stage!==stages[i-1]), ['saving','recalling','planning','repairing','saving','recalling','ready']);
  const saved=await repository.draft(document.id);
  assert.equal(saved.status,'cancelled');
  assert.match(saved.markdown,/umbrella/);
  assert.ok(saved.markdown.includes(unchanged));
  assert.doesNotMatch(saved.markdown,/predatory|\*\*\*|key was somewhere/);
  draft='';
  await runLongWriting({...options,messageId:'resumed',signal:new AbortController().signal,onWritingTask:()=>{}},adapter,{},'',paused,store,brief);
  assert.equal(requestedPassageAgain,true);
  assert.deepEqual(warnings,[]);
  const final=(await repository.get(document.id)).content.markdownProjection;
  assert.match(final,/umbrella[\s\S]*where the rain could not reach it\.[\s\S]*the last of the high water/);
  assert.doesNotMatch(final,/predatory|\*\*\*|solarium-(?:scene|memory)/);
  assert.equal((await stories.activeEvents(world.id)).find(event=>event.data.summary==='The notice stays dry.').data.knowledge[iona.id],'unknown');
  assert.equal((await repository.list()).length,1);
  assert.equal(await unfinishedWriting(repository,chat.id,document.id),null);
});
