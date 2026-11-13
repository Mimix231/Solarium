import type { AnimeAppearance } from '../domain/types';

/** Stable back-to-front paint order. Independent controls never reorder face occlusion. */
export const avatarLayerOrder = [
  'backHair', 'body', 'skin', 'face', 'eyebrows', 'eyes', 'expression', 'frontHair', 'accessories', 'lighting',
] as const;
export type AvatarLayerId = typeof avatarLayerOrder[number];
export interface AvatarLayerTransform {
  visible: boolean;
  offsetX: number;
  offsetY: number;
  scale: number;
}
export type AvatarLayerSettings = Partial<Record<AvatarLayerId, Partial<AvatarLayerTransform>>>;
export type CharacterArtStyle = 'modern' | 'classic' | 'chibi';

export const animeAccessories = [
  'none', 'moon-pin', 'pearl-drops', 'bunny-ears', 'heart-glasses', 'pocket-bird',
  'hairclip', 'tiara', 'nose-bandage', 'visor', 'ribbon', 'glasses', 'earrings', 'cat-ears', 'halo',
  'face-mask', 'beret', 'witch-hat', 'cap', 'headphones', 'eyepatch', 'choker', 'flower-crown',
] as const;
export const animeOutfits = [
  'sweater', 'pinafore', 'blazer', 'sailor', 'cape', 'gothic', 'streetwear', 'hoodie',
  'uniform', 'dress', 'jacket', 'kimono', 'turtleneck', 'armor', 'cardigan',
] as const;
export const animeBodyShapes = ['standard', 'petite', 'soft', 'tailored'] as const;
export const animeEarShapes = ['natural', 'pointed', 'hidden'] as const;
export const animeNoses = ['classic', 'button', 'minimal', 'defined'] as const;
export const animeBackdrops = ['glow', 'orbit', 'petals', 'studio'] as const;

export const characterArtStyles: Record<CharacterArtStyle, { title: string; description: string }> = {
  modern: { title: 'Modern Anime', description: 'Layered shading, reflective irises and delicate highlights.' },
  classic: { title: 'Classic Cel', description: 'Bolder outlines, warm vintage cel shading and flat color regions.' },
  chibi: { title: 'Chibi', description: 'Rounder silhouette, oversized expressive eyes and compact proportions.' },
};
export function resolveLayer(appearance: Pick<AnimeAppearance, 'layers'>, id: AvatarLayerId): AvatarLayerTransform {
  const options = appearance.layers?.[id];
  const finite = (value: unknown, fallback: number, min: number, max: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return {
    visible: options?.visible !== false,
    offsetX: finite(options?.offsetX, 0, -40, 40),
    offsetY: finite(options?.offsetY, 0, -40, 40),
    scale: finite(options?.scale, 100, 50, 150),
  };
}
/** Read/import old avatars as editable layer documents without changing existing looks or deleting choices. */
export function migrateAvatarAppearance(appearance: AnimeAppearance): AnimeAppearance {
  return { ...appearance, artStyle: appearance.artStyle ?? 'modern', layers: appearance.layers ?? {} };
}
