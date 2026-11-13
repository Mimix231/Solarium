import { createId } from "./ids";
import { isRunningInsideTauri, readAssetDataUrl, readPackagedAssetDataUrl } from "./projectFile";
import type { AssetDocument, ImportedAssetFile, SpriteFrame } from "./types";

const dataUrlCache = new Map<string, Promise<string>>();

export function clearAssetCache(relativePath?: string): void {
  if (!relativePath) {
    dataUrlCache.clear();
    return;
  }
  for (const key of dataUrlCache.keys()) {
    if (key.endsWith(`|${relativePath}`)) {
      dataUrlCache.delete(key);
    }
  }
}

export async function getAssetDataUrl(
  projectPath: string | null,
  asset: AssetDocument,
): Promise<string | null> {
  if (!asset.relativePath) return null;
  const sourceKey = projectPath ?? (isRunningInsideTauri() ? "packaged-runtime" : "");
  if (!sourceKey) return null;
  const cacheKey = `${sourceKey}|${asset.relativePath}`;
  let promise = dataUrlCache.get(cacheKey);
  if (!promise) {
    promise = projectPath
      ? readAssetDataUrl(projectPath, asset.relativePath)
      : readPackagedAssetDataUrl(asset.relativePath);
    dataUrlCache.set(cacheKey, promise);
  }
  return promise;
}

export function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The imported image could not be decoded."));
    image.src = dataUrl;
  });
}

export async function importedFileToAsset(
  projectPath: string,
  imported: ImportedAssetFile,
): Promise<AssetDocument> {
  const isAudio = imported.mimeType.startsWith("audio/");
  const temporary: AssetDocument = {
    id: createId("asset"),
    name: imported.fileName,
    kind: isAudio ? "audio" : "image",
    relativePath: imported.relativePath,
    mimeType: imported.mimeType,
    width: isAudio ? 0 : 1,
    height: isAudio ? 0 : 1,
    importedAt: new Date().toISOString(),
    frames: [],
  };
  if (isAudio) return temporary;
  const dataUrl = await getAssetDataUrl(projectPath, temporary);
  const dimensions = dataUrl ? await loadImageDimensions(dataUrl) : { width: 64, height: 64 };
  const fullFrame: SpriteFrame = {
    id: createId("frame"),
    name: "Full Image",
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    pivotX: 0.5,
    pivotY: 0.5,
  };
  return { ...temporary, width: dimensions.width, height: dimensions.height, frames: [fullFrame] };
}

export function sliceAssetGrid(
  asset: AssetDocument,
  frameWidth: number,
  frameHeight: number,
  margin = 0,
  spacing = 0,
): SpriteFrame[] {
  const frames: SpriteFrame[] = [];
  if (frameWidth <= 0 || frameHeight <= 0) return frames;
  let index = 0;
  for (let y = margin; y + frameHeight <= asset.height - margin; y += frameHeight + spacing) {
    for (let x = margin; x + frameWidth <= asset.width - margin; x += frameWidth + spacing) {
      frames.push({
        id: createId("frame"),
        name: `Frame ${index}`,
        x,
        y,
        width: frameWidth,
        height: frameHeight,
        pivotX: 0.5,
        pivotY: 0.5,
      });
      index += 1;
    }
  }
  return frames;
}
