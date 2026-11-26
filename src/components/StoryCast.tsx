import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { ChatSession } from '../domain/types';
import { profileClaimsAt, storyCanonPoint, StoryRepository, type CharacterClaim, type ClaimData, type StoryCharacter, type StoryWorld, type StoryEvent } from '../stories/repository';
import { canonPointLabel, type CanonPoint } from '../stories/canon';
import { useSolarium } from '../state/useSolarium';
import { FictionRepository, type StoryCategory, type StoryProfile } from '../stories/fiction';
import { profileSections } from '../stories/profiles';

const labels = { voice: 'Voice and speech habits', personality: 'Personality', motives: 'Goals, motives and fears',
  knowledge: 'Knowledge at this point', relationships: 'Relationships', appearance: 'Appearance',
  history: 'History', abilities: 'Abilities and limits', constraints: 'AU decisions and boundaries' } as const;
const profileFields = (Object.keys(labels) as (keyof typeof labels)[]).map(key => ({ key, label: labels[key], section: profileSections[key] }));
function fieldClaim(claims: readonly CharacterClaim[], field: typeof profileFields[number]) {
  return claims.find(claim => claim.data.section === field.section && claim.data.field === field.key) ??
    (field.key === 'motives' ? claims.find(claim => claim.data.section === field.section && claim.data.field === 'motivation') : undefined);
}
function profileOrigin(claims: readonly CharacterClaim[], field: typeof profileFields[number]) {
  const claim = fieldClaim(claims, field)?.data;
  if (claim?.locked) return 'Your saved profile';
  if (claim?.sourceLinks.length) return `Source summary · ${claim.sourceLinks[0]!.locator}`;
  if (claim?.profileDraft) return 'Spark’s AU draft';
  return undefined;
}
const pointKey=(point:CanonPoint)=>JSON.stringify([point.continuity??'',point.arc??null,point.chapter??null]);
const claimPoint=(claim:CharacterClaim):CanonPoint=>({arc:claim.data.effectiveArc,chapter:claim.data.effectiveChapter,continuity:claim.data.continuity});
export function StoryCast({ session, busy, refreshProfiles }: { session: ChatSession; busy: boolean; refreshProfiles?: string | null }) {
  const repo = useMemo(() => new StoryRepository({ sessionId: session.id, projectId: session.projectId ?? null }), [session.id, session.projectId]);
  const fiction = useMemo(() => new FictionRepository(repo), [repo]);
  const [worlds, setWorlds] = useState<StoryWorld[]>([]), [cast, setCast] = useState<StoryCharacter[]>([]), [error, setError] = useState('');
  const [categories, setCategories] = useState<StoryCategory[]>([]), [profiles, setProfiles] = useState<StoryProfile[]>([]);
  const [worldForm, setWorldForm] = useState(false), [title, setTitle] = useState(''), [origin, setOrigin] = useState<'original' | 'fanfiction'>('original'), [franchise, setFranchise] = useState('');
  const [card, setCard] = useState<StoryCharacter | 'new' | null>(null), [name, setName] = useState(''), [role, setRole] = useState(''), [portrait, setPortrait] = useState(''), [fields, setFields] = useState<Record<string, string>>({}), [saving, setSaving] = useState(false);
  const [memories,setMemories]=useState<StoryEvent[]>([]);
  const [savedClaims, setSavedClaims] = useState<CharacterClaim[]>([]);
  const [availableClaims, setAvailableClaims] = useState<CharacterClaim[]>([]);
  const [profilePoint, setProfilePoint] = useState<CanonPoint>({});
  const [profileDestination, setProfileDestination] = useState('');
  const versions = useMemo(()=>[...new Map([profilePoint,...availableClaims.map(claimPoint)].map(point=>[pointKey(point),point])).values()],
    [availableClaims,profilePoint]);
  const editingProfile = profileFields.some(field=>(fields[field.key]??'')!==(fieldClaim(savedClaims,field)?.data.value??''));
  const categoryId = session.fiction?.categoryId;
  const load = useCallback(async () => {
    const visibleWorlds=await repo.list();
    setWorlds(visibleWorlds);
    const destination=visibleWorlds.find(item=>item.id===session.profileDestination?.storyId);
    const destinationCategory=destination?(await fiction.categories(destination.id)).find(item=>item.id===session.profileDestination?.categoryId):null;
    setProfileDestination(destination&&destinationCategory?`${destination.title} › ${destinationCategory.title}`:'');
    if (!session.storyId) { setCast([]); setCategories([]); setProfiles([]); return; }
    const [characters, items] = await Promise.all([repo.characters(session.storyId), fiction.categories(session.storyId)]);
    setCast(characters); setCategories(items);
    setProfiles(categoryId && items.some(item => item.id === categoryId) ? await fiction.profiles(session.storyId, categoryId) : []);
  }, [repo, fiction, session.storyId, categoryId, session.profileDestination]);
  useEffect(() => { void load().catch(e => setError(String(e))); const timer = setInterval(() => void load().catch(e => setError(String(e))), 4000); return () => clearInterval(timer); }, [load,refreshProfiles]);
  async function chooseStory(id: string) {
    const world = worlds.find(item => item.id === id);
    setSaving(true);
    try {
      const selected = world?.scope.kind === 'library' ? await fiction.copyPersonal(id, session.projectId ?
        { kind: 'project', id: session.projectId } : { kind: 'chat', id: session.id }) : world;
      useSolarium.getState().updateSession(session.id, { storyId: selected?.id ?? null, fiction: null,profileDestination:null });
      setError('');
    } catch (reason) { setError(String(reason)); }
    finally { setSaving(false); }
  }
  async function open(character: StoryCharacter | 'new') {
    try {
      const world = worlds.find(world=>world.id===session.storyId);
      const selected = categories.find(category=>category.id===categoryId);
      const chapters = world && !selected ? await repo.store.list<{sessionId:string;canonPoint?:CanonPoint}>({
        collection:'writing_task',scopes:repo.scopes(),storyId:world.id,
      }) : [];
      const latest = chapters.filter(chapter=>chapter.data.sessionId===session.id && chapter.data.canonPoint)
        .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]?.data.canonPoint;
      const base = world ? storyCanonPoint(world) : {};
      const point = selected ? {arc:selected.data.arc??base.arc,chapter:selected.data.chapter,continuity:selected.data.continuity||base.continuity} : latest ?? base;
      const all = character === 'new' ? [] : await repo.claims(character.id, character.storyId!);
      setAvailableClaims(all);
      const newest = [...all].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
      const actualPoint = newest && !selected && !profileClaimsAt(all,point).length ? claimPoint(newest) : point;
      showProfile(all,actualPoint);
      setName(character === 'new' ? '' : character.title);
      setRole(character === 'new' ? '' : character.data.role);
      setPortrait(character === 'new' ? '' : character.data.portrait ?? '');
      setMemories(character==='new'?[]:(await repo.activeEvents(character.storyId!,actualPoint)).filter(e=>e.data.characters.includes(character.id)).slice(-4));
      setError('');setCard(character);
    } catch (e) { setError(String(e)); }
  }
  function showProfile(all: CharacterClaim[], point: CanonPoint) {
    const claims=profileClaimsAt(all,point);
    setProfilePoint(point);
    setSavedClaims(claims);
    setFields(Object.fromEntries(profileFields.map(field=>[field.key,fieldClaim(claims,field)?.data.value??''])));
  }
  async function chooseVersion(key: string) {
    const point=versions.find(item=>pointKey(item)===key);
    if (!point || !card || card==='new' || !card.storyId) return;
    showProfile(availableClaims,point);
    try{setMemories((await repo.activeEvents(card.storyId,point)).filter(e=>e.data.characters.includes(card.id)).slice(-4));}
    catch(error){setError(String(error));}
  }
  async function save() {
    if (!session.storyId || !card) return; setSaving(true);
    try {
      if(card==='new'&&(await repo.characters(session.storyId)).some(c=>[c.title,...c.data.aliases].some(n=>n.trim().normalize('NFKC').toLowerCase()===name.trim().normalize('NFKC').toLowerCase())))throw Error('That character already has a card. Open it to edit its profile.');
      let character = card === 'new' ? await repo.character(session.storyId, name, [], worlds.find(w=>w.id===session.storyId)?.data.originKind === 'original' ? 'original' : 'adapted') : card;
      character = await repo.editCharacter(character, name, { ...character.data, role, portrait: portrait || undefined });setCard(character);
      const afterEvent=(await repo.activeEvents(session.storyId,profilePoint)).reduce((n,e)=>Math.max(n,e.data.order),0);
      const claims: ClaimData[] = profileFields.filter(field => (fields[field.key] ?? '') !== (fieldClaim(savedClaims, field)?.data.value ?? ''))
        .map(field => ({ characterId: character.id, field: fieldClaim(savedClaims, field)?.data.field ?? field.key, section: field.section,
          value: fields[field.key] ?? '', kind: 'user_defined', locked: true, reviewed: true, sourceLinks: [],
          effectiveArc:profilePoint.arc,effectiveChapter:profilePoint.chapter,continuity:profilePoint.continuity,
          ...(field.key === 'knowledge' ? {dynamicKnowledge:!/^\s*(never|always|must never|must always)\b/i.test(fields[field.key]??''),knowledgeAfterEvent:afterEvent} : {}) }));
      if (claims.length) await repo.saveClaims(character, claims, true, false, profilePoint);
      setCard(null); await load(); setError('');
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return <details className="chat-story-cast"><summary>{session.storyId ? `Story cast · ${worlds.find(w => w.id === session.storyId)?.title ?? 'Loading'} · ${cast.length} characters` : 'Story characters & memories'}</summary>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {profileDestination && <Stack direction="row" spacing={1} alignItems="center" pt={.5}>
      <Typography fontSize={11} color="text.secondary">Save profiles in {profileDestination}</Typography>
      <Button size="small" disabled={busy} onClick={()=>useSolarium.getState().updateSession(session.id,{profileDestination:null})}>Use active story</Button>
    </Stack>}
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" py={1}>
      <TextField select size="small" label="Story" value={worlds.some(world => world.id === session.storyId) ? session.storyId : ''} disabled={busy || saving}
        sx={{ minWidth: 200 }} onChange={event => void chooseStory(event.target.value)}>
        <MenuItem value="">No story selected</MenuItem>
        {worlds.map(world => <MenuItem key={world.id} value={world.id}>{world.title}{world.scope.kind === 'library' ? ' · Copy from personal library' : ''}</MenuItem>)}
      </TextField>
      {categories.some(item => item.storyId === session.storyId) && <TextField select size="small" label="Fiction category"
        value={categories.some(item => item.id === categoryId) ? categoryId : ''} sx={{ minWidth: 170 }} disabled={busy || saving}
        onChange={event => useSolarium.getState().updateSession(session.id, {
          fiction: event.target.value ? { categoryId: event.target.value, characterIds: [] } : null,profileDestination:null,
        })}>
        <MenuItem value="">General cast</MenuItem>
        {categories.filter(item => item.storyId === session.storyId).map(item => <MenuItem value={item.id} key={item.id}>{item.title}</MenuItem>)}
      </TextField>}
      <Button size="small" disabled={busy || saving} onClick={() => { setTitle(''); setWorldForm(true); }}>New story</Button>
      {session.storyId && <Button size="small" disabled={busy || saving} onClick={() => void open('new')}>Add character</Button>}
    </Stack>
    {session.fiction && <Stack direction="row" gap={1} flexWrap="wrap" aria-label="Chapter cast">
      {profiles.filter(profile => profile.data.categoryId === categoryId).map(profile => {
        const id = profile.data.characterId;
        const ids = session.fiction!.characterIds;
        const selected = ids.includes(id);
        return <FormControlLabel key={profile.id} label={cast.find(character => character.id === id)?.title ?? profile.title}
          control={<Checkbox size="small" checked={selected} disabled={busy || (!selected && ids.length >= 12)}
            onChange={(_, checked) => useSolarium.getState().updateSession(session.id, {
              fiction: { categoryId: categoryId!, characterIds: checked ? [...ids, id] : ids.filter(item => item !== id) },
            })} />} />;
      })}
      {!profiles.some(profile => profile.data.categoryId === categoryId) && <Typography variant="body2" color="text.secondary">Add profiles to this category in Settings → Fiction.</Typography>}
    </Stack>}
    <div className="chat-cast-cards">{cast.map(c => <button type="button" className="chat-cast-card" key={c.id} onClick={() => void open(c)}><Avatar src={c.data.portrait} alt={c.title}>{c.title.slice(0, 2)}</Avatar><span>{c.title}<small>{c.data.role}</small></span></button>)}</div>
    <Typography fontSize={10} color="text.secondary" py={1}>Selected cast and established memories accompany writing automatically. Your Spark stays your assistant.</Typography>
    <Dialog open={worldForm} onClose={() => setWorldForm(false)} fullWidth maxWidth="sm"><DialogTitle>New story</DialogTitle><DialogContent>{error&&<Alert severity="error">{error}</Alert>}<Stack gap={2} pt={1}><TextField autoFocus label="Story title" value={title} onChange={e => setTitle(e.target.value)}/><TextField select label="Type" value={origin} onChange={e => setOrigin(e.target.value as typeof origin)}><MenuItem value="original">Original story</MenuItem><MenuItem value="fanfiction">Fanfiction</MenuItem></TextField>{origin === 'fanfiction' && <TextField label="Franchise" value={franchise} onChange={e => setFranchise(e.target.value)}/>}</Stack></DialogContent><DialogActions><Button onClick={() => setWorldForm(false)}>Cancel</Button><Button disabled={!title.trim()} onClick={() => void repo.create(title, session.projectId ? { kind: 'project', id: session.projectId } : { kind: 'chat', id: session.id }, { originKind: origin, franchiseName: franchise }).then(world => { useSolarium.getState().updateSession(session.id, { storyId: world.id }); setWorldForm(false); return load(); }).catch(e => setError(String(e)))}>Create story</Button></DialogActions></Dialog>
    <Dialog open={Boolean(card)} onClose={() => !saving && setCard(null)} fullWidth maxWidth="sm"><DialogTitle>{card === 'new' ? 'New character avatar' : name}{canonPointLabel(profilePoint) && <Typography fontSize={11} color="text.secondary">{canonPointLabel(profilePoint)}</Typography>}</DialogTitle><DialogContent>{error&&<Alert severity="error">{error}</Alert>}<Stack gap={2} pt={1}><Stack direction="row" gap={2} alignItems="center"><Avatar src={portrait} sx={{ width: 64, height: 64 }}>{name.slice(0, 2)}</Avatar><Button component="label">Local portrait<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1_500_000) { setError('Choose an image smaller than 1.5 MB.'); return; } const reader = new FileReader(); reader.onload = () => setPortrait(String(reader.result)); reader.readAsDataURL(file); }}/></Button></Stack>{versions.length>1&&<TextField select size="small" label="Profile version" disabled={saving||editingProfile} helperText={editingProfile?"Save edits to switch versions":undefined} value={pointKey(profilePoint)} onChange={e=>void chooseVersion(e.target.value)}>{versions.map(point=><MenuItem key={pointKey(point)} value={pointKey(point)}>{canonPointLabel(point)||"Shared profile"}</MenuItem>)}</TextField>}<TextField label="Character name" value={name} onChange={e => setName(e.target.value)}/><TextField label="Role in this story" value={role} onChange={e => setRole(e.target.value)}/>{profileFields.map(f => <TextField key={f.key} label={f.label} multiline minRows={2} value={fields[f.key] ?? ''} helperText={profileOrigin(savedClaims, f)} slotProps={{htmlInput:{maxLength:5000}}} onChange={e => setFields(old => ({ ...old, [f.key]: e.target.value }))}/>)}<Typography fontSize={11} color="text.secondary">Your saved profile takes precedence over automatic research. Scene memories are kept separately.</Typography>{memories.length>0&&<details><summary>Recent memories · {memories.length}</summary>{memories.map(memory=><div key={memory.id}><Typography fontSize={12} mt={1}>{memory.data.summary}</Typography><Typography fontSize={10} color="text.secondary">{card&&card!=='new'?(memory.data.knowledge[card.id]==='unknown'?'Unaware at that point':memory.data.knowledge[card.id]==='suspects'?'Suspected at that point':'Known at that point'):''}</Typography>{memory.data.quote&&<details><summary>Saved passage</summary><Typography fontSize={11}>{memory.data.quote}</Typography></details>}</div>)}</details>}</Stack></DialogContent><DialogActions><Button disabled={saving} onClick={() => setCard(null)}>Close</Button><Button disabled={saving || !name.trim()} variant="contained" onClick={() => void save()}>Save character</Button></DialogActions></Dialog>
  </details>;
}
