import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Avatar, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useLibraryContext } from '../foundation/ui-context';
import { StoryRepository, type StoryCharacter, type StoryData, type StoryWorld } from '../stories/repository';
import { FictionRepository, isStoryIcon, profileFields, profileLength, profileLimit, type ProfileField, type ProfileText,
  type StoryCategory, type StoryCategoryData, type StoryProfile } from '../stories/fiction';

const labels: Record<ProfileField, string> = {
  personality: 'Personality', appearance: 'Appearance', voice: 'Voice and dialogue', motives: 'Motives',
  history: 'History', abilities: 'Abilities', relationships: 'Relationships', knowledge: 'Knowledge at this point', constraints: 'Author rules and AU choices',
};

async function localIcon(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return undefined;
  if (file.size > 1_500_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG, or WebP image up to 1.5 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
  if (!isStoryIcon(data)) throw Error('The selected image could not be loaded.');
  return data;
}

export function FictionSettings() {
  const { access, scope } = useLibraryContext();
  const stories = useMemo(() => new StoryRepository(access), [access]);
  const fiction = useMemo(() => new FictionRepository(stories), [stories]);
  const [worlds, setWorlds] = useState<StoryWorld[]>([]);
  const [worldId, setWorld] = useState('');
  const [categoryId, setCategory] = useState('');
  const [profileId, setProfile] = useState('');
  const [worldEdit, editWorld] = useState<StoryWorld | 'new' | null>(null);
  const [categoryEdit, editCategory] = useState<StoryCategory | 'new' | null>(null);
  const [categories, setCategories] = useState<StoryCategory[]>([]);
  const [profiles, setProfiles] = useState<StoryProfile[]>([]);
  const [cast, setCast] = useState<StoryCharacter[]>([]);
  const [refresh, update] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const world = worlds.find(item => item.id === worldId);
  const category = categories.find(item => item.id === categoryId && item.storyId === worldId);
  const profile = profiles.find(item => item.id === profileId && item.data.categoryId === category?.id);
  const onError = (reason: unknown) => setError(String(reason));
  useEffect(() => {
    let live = true;
    void stories.list().then(items => { if (live) setWorlds(items); }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [stories, refresh]);
  useEffect(() => {
    let live = true;
    if (worldId) void Promise.all([fiction.categories(worldId), stories.characters(worldId)]).then(([items, characters]) => {
      if (live) { setCategories(items); setCast(characters); }
    }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [stories, fiction, worldId, refresh]);
  useEffect(() => {
    let live = true;
    if (worldId && categoryId) void fiction.profiles(worldId, categoryId).then(items => { if (live) setProfiles(items); })
      .catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [fiction, worldId, categoryId, refresh]);
  function saved(message: string) { setError(''); setNotice(message); update(value => value + 1); }

  return <Stack spacing={2}>
    <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
      <Box flex={1}><Typography variant="h6">Fiction library</Typography>
        <Typography variant="body2" color="text.secondary">Organize character profiles by story and arc. Choose the cast in chat when you’re ready to write.</Typography></Box>
      <Button variant="contained" onClick={() => { editWorld('new'); editCategory(null); setProfile(''); }}>New group</Button>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
    <div className="fiction-settings-grid">
      <Stack className="glass panel fiction-settings-list" spacing={1} component="nav" aria-label="Fiction groups">
        <Typography fontWeight={750}>Groups</Typography>
        {worlds.map(item => <Button key={item.id} variant={item.id === worldId ? 'contained' : 'text'} aria-pressed={item.id === worldId}
          onClick={() => { setWorld(item.id); setCategory(''); setProfile(''); editWorld(null); editCategory(null); }}
          startIcon={<Avatar src={item.data.icon} sx={{ width: 25, height: 25, fontSize: 11 }}>{item.title.slice(0, 2)}</Avatar>}>{item.title}</Button>)}
        {worlds.length === 0 && <Typography variant="body2" color="text.secondary">Create a group for your story.</Typography>}
      </Stack>
      <Stack className="glass panel fiction-settings-list" spacing={1} component="nav" aria-label="Fiction categories">
        <Typography fontWeight={750}>Categories</Typography>
        {world && <>
          {categories.filter(item => item.storyId === world.id).map(item => <Button key={item.id} aria-pressed={item.id === categoryId}
            variant={item.id === categoryId ? 'contained' : 'text'} onClick={() => {
              setCategory(item.id); setProfile(''); editWorld(null); editCategory(null);
            }}>{item.title}</Button>)}
          <Button onClick={() => { editCategory('new'); editWorld(null); setProfile(''); }}>New category</Button>
        </>}
        {!world && <Typography variant="body2" color="text.secondary">Choose a group.</Typography>}
      </Stack>
      <Stack className="glass panel fiction-settings-editor" spacing={2}>
        {worldEdit ? <GroupForm key={worldEdit === 'new' ? 'new' : worldEdit.id} world={worldEdit === 'new' ? undefined : worldEdit}
          hasOwner={scope.kind !== 'library'} onCancel={() => editWorld(null)} onError={onError}
          onSave={async (title, data, personal) => {
            const updated = worldEdit === 'new' ? await stories.create(title, personal ? { kind: 'library', id: 'personal' } : scope, data) :
              await stories.update(worldEdit, data, title);
            setWorld(updated.id); setCategory(''); editWorld(null); saved('Group saved.');
          }} /> : categoryEdit && world ? <CategoryForm key={categoryEdit === 'new' ? 'new' : categoryEdit.id}
          current={categoryEdit === 'new' ? undefined : categoryEdit} onCancel={() => editCategory(null)} onError={onError}
          onSave={async (title, data) => {
            const result = await fiction.saveCategory(world.id, title, data, categoryEdit === 'new' ? undefined : categoryEdit);
            setCategory(result.id); editCategory(null); saved('Category saved.');
          }} /> : world ? <>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Avatar src={world.data.icon}>{world.title.slice(0, 2)}</Avatar>
            <Box flex={1}><Typography fontWeight={750}>{world.title}{category ? ' · ' + category.title : ''}</Typography>
              <Typography variant="body2" color="text.secondary">{world.scope.kind === 'library' ? 'Personal library' : world.scope.kind === 'project' ? 'Current project' : 'Current chat'}</Typography></Box>
            <Button onClick={() => editWorld(world)}>Edit group</Button>
            {category && <Button onClick={() => editCategory(category)}>Edit category</Button>}
          </Stack>
          {category ? <>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {profiles.filter(item => item.data.categoryId === category.id).map(item => <Chip key={item.id} label={cast.find(character => character.id === item.data.characterId)?.title ?? item.title}
                color={item.id === profileId ? 'primary' : 'default'} onClick={() => setProfile(item.id)} />)}
              <Button variant="outlined" onClick={() => setProfile('new')}>Add profile</Button>
            </Stack>
            {(profile || profileId === 'new') && <ProfileForm key={category.id + '/' + profileId} profile={profile}
              cast={cast} onError={onError} onLoad={item => fiction.read(item)} onSave={async (fields, name, existing, portrait, aliases) => {
                let character = cast.find(item => item.id === existing);
                if (!character && cast.some(item => [item.title, ...item.data.aliases].some(value => value.toLowerCase() === name.trim().toLowerCase()))) {
                  throw Error('Choose the existing character to create another arc profile.');
                }
                character ??= await stories.character(world.id, name, [], world.data.originKind === 'original' ? 'original' : 'adapted');
                if (character.title !== name.trim() || character.data.portrait !== portrait || character.data.aliases.join(', ') !== aliases) {
                  character = await stories.editCharacter(character, name, { ...character.data, portrait, aliases: aliases.split(',').map(value => value.trim()).filter(Boolean) });
                }
                const result = await fiction.saveProfile(world.id, category.id, character.id, fields, profile?.version ?? null);
                setProfile(result.id); saved('Character profile saved.');
              }} />}
          </> : <Typography color="text.secondary">Create or select a category for this group.</Typography>}
        </> : <Typography color="text.secondary">Select a story group to manage its categories and cast.</Typography>}
      </Stack>
    </div>
  </Stack>;
}

function GroupForm({ world, hasOwner, onCancel, onSave, onError }: {
  world?: StoryWorld; hasOwner: boolean; onCancel(): void; onError(error: unknown): void;
  onSave(title: string, data: Partial<StoryData>, personal: boolean): Promise<void>;
}) {
  const [title, setTitle] = useState(world?.title ?? '');
  const [data, setData] = useState<Partial<StoryData>>({ originKind: world?.data.originKind ?? 'fanfiction',
    icon: world?.data.icon, franchiseName: world?.data.franchiseName ?? '', canonAnchor: world?.data.canonAnchor ?? '',
    divergenceNote: world?.data.divergenceNote ?? '', chapterTarget: world?.data.chapterTarget });
  const [personal, setPersonal] = useState(!hasOwner);
  return <FictionForm title={world ? 'Edit group' : 'New group'} label="Save group" ready={Boolean(title.trim())}
    onCancel={onCancel} onError={onError} onSave={() => onSave(title, data, personal)}>
    <TextField label="Group name" value={title} onChange={event => setTitle(event.target.value)} />
    <Stack direction="row" spacing={1} alignItems="center"><Avatar src={data.icon}>{title.slice(0, 2)}</Avatar>
      <Button component="label">Choose group icon<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => {
        void localIcon(event).then(icon => { if (icon) setData(old => ({ ...old, icon })); }).catch(onError);
      }} /></Button>
      {data.icon && <Button onClick={() => setData(old => ({ ...old, icon: undefined }))}>Clear icon</Button>}
    </Stack>
    <TextField select label="Story type" value={data.originKind} onChange={event => setData(old => ({ ...old, originKind: event.target.value as StoryData['originKind'] }))}>
      <MenuItem value="fanfiction">Fanfiction</MenuItem><MenuItem value="original">Original story</MenuItem><MenuItem value="mixed">Mixed</MenuItem>
    </TextField>
    <TextField label="Franchise or source title" value={data.franchiseName} onChange={event => setData(old => ({ ...old, franchiseName: event.target.value }))} />
    <TextField label="Canon edition or continuity" value={data.canonAnchor} onChange={event => setData(old => ({ ...old, canonAnchor: event.target.value }))} />
    <TextField multiline label="Author’s continuity and AU choices" value={data.divergenceNote} onChange={event => setData(old => ({ ...old, divergenceNote: event.target.value }))} />
    <TextField type="number" label="Default chapter target (characters)" value={data.chapterTarget ?? ''} helperText="Optional. A length in the chat request takes precedence."
      onChange={event => { const value = event.target.value; setData(old => ({ ...old, chapterTarget: value ? Number(value) : undefined })); }} />
    {!world && hasOwner && <TextField select label="Save to" value={personal ? 'personal' : 'owner'} onChange={event => setPersonal(event.target.value === 'personal')}>
      <MenuItem value="owner">Current chat or project</MenuItem><MenuItem value="personal">Personal library</MenuItem>
    </TextField>}
  </FictionForm>;
}

function CategoryForm({ current, onSave, onCancel, onError }: {
  current?: StoryCategory; onSave(title: string, data: StoryCategoryData): Promise<void>; onCancel(): void; onError(error: unknown): void;
}) {
  const [title, setTitle] = useState(current?.title ?? '');
  const [data, setData] = useState<StoryCategoryData>(current?.data ?? {});
  return <FictionForm title={current ? 'Edit category' : 'New category'} label="Save category" ready={Boolean(title.trim())}
    onSave={() => onSave(title, data)} onCancel={onCancel} onError={onError}>
    <TextField label="Category name" value={title} onChange={event => setTitle(event.target.value)} />
    {(['arc', 'chapter'] as const).map(key => <TextField key={key} type="number" label={key === 'arc' ? 'Arc number' : 'Chapter boundary'}
      value={data[key] ?? ''} onChange={event => { const value = event.target.value; setData(old => ({ ...old, [key]: value ? Number(value) : undefined })); }} />)}
    <TextField label="Continuity override" value={data.continuity ?? ''} helperText="Leave blank to use the group’s continuity."
      onChange={event => setData({ ...data, continuity: event.target.value })} />
  </FictionForm>;
}

function ProfileForm({ profile, cast, onLoad, onSave, onError }: {
  profile?: StoryProfile; cast: StoryCharacter[]; onLoad(profile: StoryProfile): Promise<ProfileText>; onError(error: unknown): void;
  onSave(fields: ProfileText, name: string, existing: string, portrait: string | undefined, aliases: string): Promise<void>;
}) {
  const character = cast.find(item => item.id === profile?.data.characterId);
  const [name, setName] = useState(character?.title ?? profile?.title ?? '');
  const [existing, setExisting] = useState(character?.id ?? '');
  const [aliases, setAliases] = useState(character?.data.aliases.join(', ') ?? '');
  const [portrait, setPortrait] = useState(character?.data.portrait);
  const [field, setField] = useState<ProfileField>('personality');
  const [fields, setFields] = useState<ProfileText>({});
  const [loaded, setLoaded] = useState(!profile);
  const version = profile?.version;
  const item = useMemo(() => profile, [profile]);
  useEffect(() => {
    let live = true;
    if (item) {
      setLoaded(false);
      void onLoad(item).then(value => { if (live) { setFields(value); setLoaded(true); } })
        .catch(reason => { if (live) onError(reason); });
    }
    return () => { live = false; };
    // Editor changes follow the persisted version, rather than callbacks from parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, version]);
  const value = fields[field] ?? '';
  const length = profileLength(value);
  const tooLong = Object.values(fields).some(text => profileLength(text) > profileLimit);
  return <FictionForm title={profile ? 'Edit character profile' : 'New character profile'} label="Save profile"
    ready={loaded && Boolean(name.trim()) && !tooLong} onSave={() => onSave(fields, name, existing, portrait, aliases)} onError={onError}>
    {!profile && <TextField select label="Character identity" value={existing} onChange={event => {
      const id = event.target.value; const selected = cast.find(item => item.id === id);
      setExisting(id); setName(selected?.title ?? ''); setAliases(selected?.data.aliases.join(', ') ?? ''); setPortrait(selected?.data.portrait);
    }}>
      <MenuItem value="">Create a character</MenuItem>{cast.map(item => <MenuItem value={item.id} key={item.id}>{item.title}</MenuItem>)}
    </TextField>}
    <Stack direction="row" gap={1} alignItems="center"><Avatar src={portrait}>{name.slice(0, 2)}</Avatar>
      <Button component="label">Choose portrait<input type="file" hidden accept="image/png,image/jpeg,image/webp"
        onChange={event => { void localIcon(event).then(icon => { if (icon) setPortrait(icon); }).catch(onError); }} /></Button></Stack>
    <TextField label="Character name" value={name} onChange={event => setName(event.target.value)} />
    <TextField label="Aliases (comma separated)" value={aliases} onChange={event => setAliases(event.target.value)} />
    <TextField select label="Profile section" value={field} onChange={event => setField(event.target.value as ProfileField)}>
      {profileFields.map(key => <MenuItem key={key} value={key}>{labels[key]}{fields[key] ? ' · saved draft' : ''}</MenuItem>)}
    </TextField>
    <TextField multiline minRows={8} maxRows={18} disabled={!loaded} label={labels[field]} value={value} error={length > profileLimit}
      onChange={event => setFields({ ...fields, [field]: event.target.value })} helperText={`${length.toLocaleString()} / ${profileLimit.toLocaleString()} characters`} />
  </FictionForm>;
}

function FictionForm({ title, label, ready, onSave, onCancel, onError, children }: {
  title: string; label: string; ready: boolean; onSave(): Promise<void>; onCancel?(): void; onError(error: unknown): void; children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    try { await onSave(); } catch (error) { onError(error); }
    finally { setBusy(false); }
  }
  return <Stack component="form" onSubmit={event => void submit(event)} gap={1.5}>
    <Typography fontWeight={750}>{title}</Typography>
    {children}
    <Stack direction="row" gap={1}><Button type="submit" variant="contained" disabled={!ready || busy}>{busy ? 'Saving…' : label}</Button>
      {onCancel && <Button disabled={busy} onClick={onCancel}>Cancel</Button>}</Stack>
  </Stack>;
}
