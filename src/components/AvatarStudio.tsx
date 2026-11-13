import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, Divider, IconButton, Slider, Stack, Tooltip, Typography } from '@mui/material';
import UndoRounded from '@mui/icons-material/UndoRounded';
import RedoRounded from '@mui/icons-material/RedoRounded';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded';
import type { AnimeAppearance, SparkAvatar } from '../domain/types';
import { defaultAnime, newSpark } from '../domain/defaults';
import { validateSpark } from '../domain/validation';
import { AnimeAvatar } from './AnimeAvatar';
import { AvatarView } from './AvatarView';
import { AvatarExpressionEditor, AvatarLayerEditor, AvatarStylePicker } from './AvatarEvolutionControls';
import { animeAccessories, animeBackdrops, animeBodyShapes, animeEarShapes, animeNoses, animeOutfits } from '../avatar/layer-system';

type Category = 'Presets' | 'Hair' | 'Face' | 'Eyes' | 'Body' | 'Outfits' | 'Accessories' | 'Cosmetics' | 'Background' | 'Expressions' | 'Layers' | 'Art Styles';
type OptionKey = 'hairstyle' | 'bangs' | 'face' | 'eyeShape' | 'outfit' | 'accessory' | 'accessorySecondary' | 'sideHair' |
  'brows' | 'pupil' | 'mouth' | 'irisPattern' | 'makeup' | 'bodyShape' | 'ears' | 'nose' | 'backdrop';
const navGroups: { title: string; categories: Category[] }[] = [
  { title: 'Canvas', categories: ['Presets', 'Art Styles', 'Background', 'Layers'] },
  { title: 'Character', categories: ['Hair', 'Face', 'Eyes', 'Body', 'Cosmetics', 'Expressions'] },
  { title: 'Wardrobe', categories: ['Outfits', 'Accessories'] },
];
const options: Record<OptionKey, readonly string[]> = {
  hairstyle: ['soft-bob','shag','long-waves','short-curls','side-braid','high-ponytail','low-twintails','bob','long','twin-tails','ponytail','pixie','hime','messy','wolf-cut','braided-crown','side-ponytail','curly','layered','ahoge'],
  bangs: ['curtain','straight','swept','wispy','hime-cut','side-part','micro'], face: ['oval','round','sharp'],
  eyeShape: ['gentle','fox','doll','hooded','downturned','round','sharp','sleepy','almond','droopy','wide','narrow','upturned'],
  outfit: animeOutfits, accessory: animeAccessories, accessorySecondary: animeAccessories,
  bodyShape: animeBodyShapes, ears: animeEarShapes, nose: animeNoses, backdrop: animeBackdrops,
  sideHair: ['none','wispy','braids','ringlets','long-locks','short-locks'], brows: ['soft','arched','straight'], pupil: ['round','star','slit','heart','diamond','cat'], irisPattern: ['solid','ringed','sunburst','sparkle','gradient','flower','spiral','nebula','diamond','constellation'], makeup: ['none','freckles','eyeliner','beauty-mark','star-cheeks'],
  mouth: ['subtle','smile','smirk','neutral','grin','laugh','fang','pout','open','cat-smile','frown','soft-smile'],
};
const presets: { name: string; values: Partial<AnimeAppearance> }[] = [
  { name: 'Starlight Tailor', values: { hairstyle: 'soft-bob', bangs: 'side-part', hairColor: '#27263e', hairAccent: '#688cc3',
    skin: '#d7a080', eyeShape: 'doll', eyeColor: '#72c7bc', irisPattern: 'constellation', mouth: 'soft-smile',
    nose: 'button', bodyShape: 'petite', outfit: 'sweater', outfitColor: '#3a4264', outfitAccent: '#b5bce9',
    accessory: 'moon-pin', accessorySecondary: 'pocket-bird', accessoryAccent: '#f6d5b0', backdrop: 'orbit', background: '#252d4c' } },
  { name: 'Moonlit Scholar', values: { hairstyle: 'long', bangs: 'curtain', hairColor: '#373156', hairAccent: '#8e82ce', eyeColor: '#cfb4f6', outfit: 'uniform', outfitColor: '#313f73', background: '#242b4e' } },
  { name: 'Cherry Blossom', values: { hairstyle: 'twin-tails', bangs: 'straight', hairColor: '#bc5374', hairAccent: '#ed94aa', eyeColor: '#64b5a0', outfit: 'dress', background: '#7b4762' } },
  { name: 'Citrus Runner', values: { hairstyle: 'pixie', bangs: 'swept', hairColor: '#a75e31', hairAccent: '#ffc56b', eyeColor: '#6a9c52', outfit: 'hoodie', background: '#405d51' } },
  { name: 'Blueberry Knight', values: { hairstyle: 'hime', bangs: 'curtain', hairColor: '#222d67', hairAccent: '#607bd5', eyeColor: '#f1cc83', outfit: 'jacket', background: '#1f315b' } },
  { name: 'Kiwi Inventor', values: { hairstyle: 'messy', bangs: 'swept', hairColor: '#45532f', hairAccent: '#a1bd71', eyeColor: '#90a8d6', outfit: 'hoodie', background: '#263d38' } },
];
const label = (name: string): string => name.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface Props { name: string; avatar: SparkAvatar; onChange: (avatar: SparkAvatar) => void }
export function AvatarStudio({ name, avatar, onChange }: Props) {
  const [category, setCategory] = useState<Category>('Presets');
  const [undo, setUndo] = useState<SparkAvatar[]>([]);
  const [redo, setRedo] = useState<SparkAvatar[]>([]);
  const [warning, setWarning] = useState('');
  const [neutralPreview, setNeutralPreview] = useState(false);
  const [accessorySlot, setAccessorySlot] = useState<'accessory' | 'accessorySecondary'>('accessory');
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const expressionRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const a = { ...defaultAnime, ...avatar.anime };
  function commit(next: SparkAvatar) {
    setUndo((items) => [...items.slice(-39), structuredClone(avatar)]);
    setRedo([]);
    onChange(next);
  }
  const patch = (values: Partial<AnimeAppearance>) => commit({ ...avatar, style: 'anime', image: undefined, anime: { ...a, ...values } });
  const choose = <K extends OptionKey>(key: K, value: AnimeAppearance[K]) => patch({ [key]: value });
  function travel(direction: 'undo' | 'redo') {
    const from = direction === 'undo' ? undo : redo;
    const last = from.at(-1);
    if (!last) return;
    if (direction === 'undo') { setUndo((s) => s.slice(0, -1)); setRedo((s) => [...s, avatar]); }
    else { setRedo((s) => s.slice(0, -1)); setUndo((s) => [...s, avatar]); }
    onChange(last);
  }
  function exportPreset() {
    const blob = new Blob([JSON.stringify({ format: 'solarium-anime-avatar-v2', avatar: { ...avatar, style: 'anime', anime: a } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'spark'}-anime.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importPreset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('Avatar preset exceeds 2 MB.');
      const data = JSON.parse(await file.text()) as { format?: string; avatar?: unknown };
      if (!['solarium-anime-avatar-v1','solarium-anime-avatar-v2'].includes(data.format ?? '')) throw Error('Not a supported Solarium anime avatar preset.');
      commit(validateSpark({ ...newSpark(), avatar: data.avatar }).avatar);
    } catch (error) { setWarning(String(error)); }
  }
  async function exportPNG() {
    const source = previewRef.current?.querySelector('svg');
    const raster = previewRef.current?.querySelector('img');
    if (!source && !raster) { setWarning('No avatar preview is available to export.'); return; }
    const image = new Image();
    try {
      const src = source ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(source))}` : raster!.src;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(Error('Cannot render this portrait.')); image.src = src; });
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
      const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas export is unavailable.');
      ctx.drawImage(image, 0, 0, 1024, 1024);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(Error('PNG encoding failed.')), 'image/png'));
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'spark'}-avatar.png`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setWarning(`Could not export PNG: ${String(error)}`); }
  }
  function importExpressionImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1_500_000) { setWarning('Use PNG, JPEG or WebP under 1.5 MB.'); return; }
    const expression = avatar.expression;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') commit({ ...avatar, expressionImages: { ...avatar.expressionImages, [expression]: reader.result } }); };
    reader.readAsDataURL(file);
  }
  function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1_500_000) { setWarning('Use a PNG, JPEG or WebP image under 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') commit({ ...avatar, image: reader.result, style: 'anime' });
    };
    reader.readAsDataURL(file);
  }
  const color = (key: keyof AnimeAppearance, title: string, fallback = a.eyeColor) => <label className="color-label" key={key}>{title}<input type="color" value={typeof a[key] === 'string' && /^#[0-9a-f]{6}$/i.test(a[key] as string) ? String(a[key]) : fallback} aria-label={title} onChange={(e: ChangeEvent<HTMLInputElement>) => patch({ [key]: e.target.value })} /></label>;
  const gallery = (key: OptionKey, title: string) => <Box mb={2}><Typography mb={1} fontSize={12} fontWeight={750}>{title}</Typography><div className="avatar-option-grid">{options[key].map((choice) => {
    const otherAccessory = key === 'accessory' ? 'accessorySecondary' : key === 'accessorySecondary' ? 'accessory' : null;
    const example: SparkAvatar = { ...avatar, style: 'anime', image: undefined, expression: 'neutral', anime: {
      ...a, animateEyes: false, expressionPresets: undefined, ...(otherAccessory ? { [otherAccessory]: 'none' } : {}), [key]: choice,
    } };
    return <button type="button" key={choice} className={`avatar-option ${a[key] === choice ? 'chosen' : ''}`} onClick={() => choose(key, choice as never)} aria-pressed={a[key] === choice}>
      <span aria-hidden="true" className="avatar-option-art"><AnimeAvatar avatar={example} size={74}/></span><span>{label(choice)}</span></button>;
  })}</div></Box>;
  const slider = (key: 'blush' | 'eyeScale' | 'hairVolume' | 'zoom' | 'offsetX' | 'offsetY' | 'shoulderWidth' | 'neckWidth' | 'sparkle', min: number, max: number, title: string) => <Box key={key}>
    <Stack direction="row" justifyContent="space-between"><Typography fontSize={11}>{title}</Typography><Typography fontSize={11} color="text.secondary">{a[key]}</Typography></Stack>
    <Slider size="small" aria-label={title} value={a[key]} min={min} max={max} onChange={(_event: unknown, v: number | number[]) => patch({ [key]: v as number })}/>
  </Box>;
  return <div className="avatar-studio-embedded">
    <header className="avatar-studio-header"><Stack direction="row" alignItems="center" gap={1.5}><AvatarView avatar={avatar} size={35}/><Box><Typography fontWeight={800} fontSize={15}>Spark Avatar Studio</Typography><Typography fontSize={10.5} color="text.secondary">{name} · Original anime character creator</Typography></Box></Stack>
      <Stack direction="row" alignItems="center" gap={.8}>
        <Tooltip title="Undo"><span><IconButton disabled={!undo.length} aria-label="Undo avatar change" onClick={() => travel('undo')}><UndoRounded /></IconButton></span></Tooltip>
        <Tooltip title="Redo"><span><IconButton disabled={!redo.length} aria-label="Redo avatar change" onClick={() => travel('redo')}><RedoRounded /></IconButton></span></Tooltip>
        <Button startIcon={<FileUploadRounded />} onClick={() => fileRef.current?.click()}>Import</Button>
        <Button startIcon={<FileDownloadRounded />} onClick={exportPreset}>Preset JSON</Button><Button onClick={() => void exportPNG()}>Export PNG</Button>
        <Chip size="small" variant="outlined" label="Autosaved to Spark" />
      </Stack>
    </header>
    <div className="avatar-studio-layout">
      <nav className="avatar-studio-nav" aria-label="Avatar customization categories">
        {navGroups.map(group => <div key={group.title} className="avatar-nav-group">
          <span>{group.title}</span>
          {group.categories.map(item => <button className={category === item ? 'active' : ''} aria-pressed={category === item}
            type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>)}
      </nav>
      <main className="avatar-stage">
        <div className="avatar-stage-preview" ref={previewRef}><AvatarView avatar={neutralPreview ? { ...avatar, expression: 'neutral' } : avatar} size={330} active /></div>
        <Button size="small" aria-pressed={neutralPreview} variant={neutralPreview ? 'outlined' : 'text'}
          onClick={() => setNeutralPreview(value => !value)} sx={{ mt: 1 }}>Neutral preview</Button>
        <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1} mt={1}>{(['neutral','happy','curious','focused','sad','angry','surprised','embarrassed'] as const).map((e) => <Chip clickable key={e} label={label(e)} color={avatar.expression === e ? 'primary' : 'default'} variant={avatar.expression === e ? 'filled' : 'outlined'} onClick={() => { setNeutralPreview(false); commit({ ...avatar, expression: e }); }}/>)}</Stack>
        <Typography align="center" fontSize={11} color="text.secondary" mt={2}>Changes save automatically to this Spark. Undo and redo are available until the editor closes.</Typography>
        <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={(e: ChangeEvent<HTMLInputElement>) => void importPreset(e)}/>
        <input hidden ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={importImage}/><input hidden ref={expressionRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={importExpressionImage}/>
        {warning && <Alert severity="warning" onClose={() => setWarning('')} sx={{ mt: 2, maxWidth: 420 }}>{warning}</Alert>}
      </main>
      <aside className="avatar-properties"><Typography variant="h6" mb={2}>{category}</Typography>
        {category === 'Art Styles' && <AvatarStylePicker avatar={avatar} appearance={a} onPatch={patch} />}
        {category === 'Layers' && <AvatarLayerEditor avatar={avatar} appearance={a} onPatch={patch} />}
        {category === 'Presets' && <><Typography fontSize={12} color="text.secondary" mb={2}>Choose a character silhouette and customize hair, eyes, iris design, expressions, clothing, hats, masks and cosmetics as independent parts.</Typography><div className="avatar-option-grid">{presets.map((p) => <button className="avatar-option" key={p.name} onClick={() => patch(p.values)}><AnimeAvatar size={90} avatar={{ ...avatar, style: 'anime', image: undefined, anime: { ...a, ...p.values } }} /><span>{p.name}</span></button>)}</div><Divider sx={{ my: 2 }}/><Button fullWidth variant="outlined" onClick={() => commit({ ...avatar, style: 'anime', image: undefined, anime: { ...defaultAnime } })}>Restore anime defaults</Button><Button fullWidth sx={{ mt: 1 }} onClick={() => imageRef.current?.click()}>Import finished portrait</Button>{avatar.image && <Button onClick={() => commit({ ...avatar, image: undefined })}>Return to editable layers</Button>}</>}
        {category === 'Hair' && <>{gallery('hairstyle','Hairstyles')}{gallery('bangs','Fringe / Bangs')}{gallery('sideHair','Side locks / braids')}{color('hairColor','Hair color')}{color('hairAccent','Hair highlights')}{slider('hairVolume',70,140,'Hair volume')}</>}
        {category === 'Face' && <>{gallery('face','Face silhouette')}{gallery('nose','Nose')}{gallery('brows','Eyebrow shape')}{gallery('mouth','Mouth shape in neutral expressions')}{color('skin','Skin tone')}{slider('blush',0,100,'Blush')}</>}
        {category === 'Eyes' && <>{gallery('eyeShape','Eye shapes')}{gallery('irisPattern','Iris patterns')}{gallery('pupil','Pupil styles')}{color('eyeColor','Default iris color')}{color('leftEyeColor','Left iris color')}{color('rightEyeColor','Right iris color')}{slider('sparkle',0,100,'Eye highlight')}{slider('eyeScale',60,140,'Eye size')}</>}
        {category === 'Body' && <>{gallery('bodyShape','Bust silhouette')}{gallery('ears','Ear shape')}{slider('shoulderWidth',70,145,'Shoulder width')}{slider('neckWidth',70,135,'Neck width')}</>}
        {category === 'Outfits' && <>{gallery('outfit','Clothing')}{color('outfitColor','Fabric color')}{color('outfitAccent','Trim and ribbons')}</>}
        {category === 'Accessories' && <>
          <div className="avatar-accessory-slots" role="group" aria-label="Accessory slots">
            <button type="button" aria-pressed={accessorySlot === 'accessory'} onClick={() => setAccessorySlot('accessory')}>
              <strong>Primary</strong><span>{label(a.accessory)}</span>
            </button>
            <button type="button" aria-pressed={accessorySlot === 'accessorySecondary'} onClick={() => setAccessorySlot('accessorySecondary')}>
              <strong>Secondary</strong><span>{label(a.accessorySecondary)}</span>
            </button>
          </div>
          {color('accessoryAccent','Accessory accent', a.outfitAccent)}
          {a.accessoryAccent && <Button size="small" onClick={() => patch({ accessoryAccent: undefined })}>Use outfit trim</Button>}
          {gallery(accessorySlot, accessorySlot === 'accessory' ? 'Primary accessory' : 'Secondary accessory')}
        </>}
        {category === 'Cosmetics' && <>{gallery('makeup','Face details and makeup')}{slider('blush',0,100,'Blush intensity')}{slider('sparkle',0,100,'Eye shimmer')}</>}
        {category === 'Background' && <>{gallery('backdrop','Backdrop elements')}{color('background','Backdrop')}<label className="color-label">Gradient highlight<input type="color" value={avatar.secondary} onChange={(e: ChangeEvent<HTMLInputElement>) => commit({ ...avatar, secondary: e.target.value })}/></label><label className="color-label">Accent color<input type="color" value={avatar.color} onChange={(e: ChangeEvent<HTMLInputElement>) => commit({ ...avatar, color: e.target.value })}/></label><Typography color="text.secondary" fontSize={11} my={1}>Use the controls below to reposition the avatar independently of the background.</Typography>{slider('zoom',75,140,'Portrait zoom')}{slider('offsetX',-45,45,'Move horizontally')}{slider('offsetY',-45,45,'Move vertically')}</>}
        {category === 'Expressions' && <AvatarExpressionEditor
          avatar={avatar}
          appearance={a}
          onPatch={patch}
          onImportImage={() => expressionRef.current?.click()}
          onRemoveImage={() => {
            const images = { ...avatar.expressionImages };
            delete images[avatar.expression];
            commit({ ...avatar, expressionImages: images });
          }}
          onAnimate={(enabled) => commit({ ...avatar, animate: enabled })}
        />}

      </aside>
    </div>
  </div>;
}
