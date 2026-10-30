import { Box, Button, Slider, Stack, Switch, Typography } from '@mui/material';
import type { ChangeEvent } from 'react';
import type { AnimeAppearance, AnimeEyes, AnimeExpressionPreset, SparkAvatar } from '../domain/types';
import { avatarLayerOrder, characterArtStyles, resolveLayer, type CharacterArtStyle } from '../avatar/layer-system';
import { AnimeAvatar } from './AnimeAvatar';

const title = (value: string): string => value.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const expressions = {
  mouth: ['subtle', 'smile', 'smirk', 'neutral', 'grin', 'laugh', 'fang', 'pout', 'open', 'cat-smile', 'frown', 'soft-smile'],
  eyeShape: ['gentle', 'fox', 'doll', 'hooded', 'downturned', 'round', 'sharp', 'sleepy', 'almond', 'droopy', 'wide', 'narrow', 'upturned'],
  brows: ['soft', 'arched', 'straight'],
} as const;

interface AppearanceProps {
  avatar: SparkAvatar;
  appearance: AnimeAppearance;
  onPatch: (patch: Partial<AnimeAppearance>) => void;
}

export function AvatarStylePicker({ avatar, appearance, onPatch }: AppearanceProps) {
  return <>
    <Typography fontSize={12} color="text.secondary" mb={2}>
      Different proportions, outlines, shading and eye treatments. Your existing avatar remains editable.
    </Typography>
    <div className="avatar-option-grid avatar-style-grid">
      {(Object.entries(characterArtStyles) as [CharacterArtStyle, typeof characterArtStyles.modern][]).map(([style, info]) =>
        <button key={style} type="button" className={`avatar-option ${appearance.artStyle === style ? 'chosen' : ''}`}
          onClick={() => onPatch({ artStyle: style })} aria-pressed={appearance.artStyle === style}>
          <AnimeAvatar size={95} avatar={{ ...avatar, image: undefined, style: 'anime', anime: { ...appearance, artStyle: style } }} />
          <span>{info.title}</span>
          <Typography fontSize={10} color="text.secondary">{info.description}</Typography>
        </button>,
      )}
    </div>
  </>;
}

export function AvatarLayerEditor({ appearance, onPatch }: AppearanceProps) {
  return <>
    <Typography fontSize={12} color="text.secondary" mb={1}>
      Independently position, resize or hide each illustration layer. Back-to-front ordering is preserved.
    </Typography>
    {avatarLayerOrder.map((id) => {
      const config = resolveLayer(appearance, id);
      const update = (value: Partial<typeof config>) => onPatch({
        layers: { ...appearance.layers, [id]: { ...config, ...value } },
      });
      return <Box key={id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontSize={12} fontWeight={700}>{title(id)}</Typography>
          <Switch size="small" checked={config.visible}
            onChange={(event: ChangeEvent<HTMLInputElement>) => update({ visible: event.target.checked })} />
        </Stack>
        {config.visible && ([
          ['Horizontal', 'offsetX', -40, 40],
          ['Vertical', 'offsetY', -40, 40],
          ['Size', 'scale', 50, 150],
        ] as const).map(([label, key, min, max]) => <Box key={key}>
          <Typography fontSize={10} color="text.secondary">
            {label}: {config[key]}{key === 'scale' ? '%' : ''}
          </Typography>
          <Slider size="small" min={min} max={max} value={config[key]}
            onChange={(_event: unknown, value: number | number[]) => update({ [key]: value as number })} />
        </Box>)}
      </Box>;
    })}
  </>;
}

export interface ExpressionEditorProps extends AppearanceProps {
  onImportImage: () => void;
  onRemoveImage: () => void;
  onAnimate: (enabled: boolean) => void;
}

export function AvatarExpressionEditor({ avatar, appearance, onPatch, onImportImage, onRemoveImage, onAnimate }: ExpressionEditorProps) {
  const expression = avatar.expression;
  const current = appearance.expressionPresets?.[expression] ?? {};
  const update = (values: AnimeExpressionPreset) => onPatch({
    expressionPresets: { ...appearance.expressionPresets, [expression]: { ...current, ...values } },
  });
  return <>
    <Typography fontSize={12} color="text.secondary" mb={2}>
      Select an expression below the portrait. These settings affect that expression only, not your other expressions.
    </Typography>
    {(Object.entries(expressions) as [keyof typeof expressions, readonly string[]][]).map(([field, choices]) =>
      <Box key={field} mb={2}>
        <Typography mb={1} fontWeight={700} fontSize={12}>{title(field)}</Typography>
        <div className="avatar-option-grid">{choices.map((choice) => {
          const selected = current[field] === choice;
          const choiceOverride: AnimeExpressionPreset = field === 'eyeShape'
            ? { eyeShape: choice as AnimeEyes }
            : field === 'mouth'
              ? { mouth: choice as AnimeAppearance['mouth'] }
              : { brows: choice as AnimeAppearance['brows'] };
          const override = { ...current, ...choiceOverride };
          const example: SparkAvatar = {
            ...avatar, style: 'anime', image: undefined,
            anime: { ...appearance, expressionPresets: { ...appearance.expressionPresets, [expression]: override } },
          };
          return <button key={choice} type="button" aria-pressed={selected}
            className={`avatar-option ${selected ? 'chosen' : ''}`} onClick={() => update(override)}>
            <AnimeAvatar size={64} avatar={example} />
            <span>{title(choice)}</span>
          </button>;
        })}</div>
      </Box>,
    )}
    <Typography fontSize={11}>Expression blush: {current.blush ?? appearance.blush}%</Typography>
    <Slider size="small" min={0} max={100} value={current.blush ?? appearance.blush}
      onChange={(_event: unknown, value: number | number[]) => update({ blush: value as number })} />
    <Button fullWidth onClick={() => {
      const copy = { ...appearance.expressionPresets };
      delete copy[expression];
      onPatch({ expressionPresets: copy });
    }}>Reset current expression</Button>
    <Button fullWidth variant="outlined" onClick={onImportImage}>Upload {title(expression)} expression portrait</Button>
    {avatar.expressionImages?.[expression] && <Button fullWidth onClick={onRemoveImage}>Remove expression portrait</Button>}
    <Stack direction="row" alignItems="center" gap={1}>
      Subtle idle animation
      <Switch checked={avatar.animate}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onAnimate(event.target.checked)} />
    </Stack>
  </>;
}
