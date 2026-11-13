import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Grid2X2,
  Image,
  Import,
  Music,
  List,
  Scissors,
  Search,
  Trash2,
} from "lucide-react";
import { getAssetDataUrl } from "../editor/assets";
import { deleteAssetFile, revealAssetFile } from "../editor/projectFile";
import { useEditorStore } from "../editor/store";
import type { AssetDocument } from "../editor/types";

export function AssetThumbnail({ asset, className = "" }: { asset: AssetDocument; className?: string }) {
  const projectPath = useEditorStore((state) => state.projectPath);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAssetDataUrl(projectPath, asset)
      .then((dataUrl) => {
        if (active) setUrl(dataUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [projectPath, asset.id, asset.relativePath]);

  return (
    <div className={`asset-thumbnail ${className}`}>
      {asset.kind === "audio" ? <Music size={24} /> : url ? <img src={url} alt="" draggable={false} /> : <Image size={24} />}
    </div>
  );
}


export function AssetFrameThumbnail({ asset, frameId, className = "" }: { asset: AssetDocument; frameId: string; className?: string }) {
  const projectPath = useEditorStore((state) => state.projectPath);
  const [url, setUrl] = useState<string | null>(null);
  const frame = asset.frames.find((candidate) => candidate.id === frameId) ?? null;

  useEffect(() => {
    let active = true;
    void getAssetDataUrl(projectPath, asset).then((dataUrl) => { if (active) setUrl(dataUrl); }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [projectPath, asset.id, asset.relativePath]);

  return (
    <div className={`asset-thumbnail asset-frame-thumbnail ${className}`}>
      {url && frame ? (
        <span style={{
          width: frame.width, height: frame.height,
          backgroundImage: `url(${url})`,
          backgroundPosition: `-${frame.x}px -${frame.y}px`,
          backgroundRepeat: "no-repeat",
        }} />
      ) : <Image size={24} />}
    </div>
  );
}

export function AssetBrowser({
  onImport,
  onImportFolder,
  onSlice,
}: {
  onImport: () => void;
  onImportFolder: () => void;
  onSlice: (assetId: string) => void;
}) {
  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const selectedAssetId = useEditorStore((state) => state.selectedAssetId);
  const assetViewMode = useEditorStore((state) => state.assetViewMode);
  const assetSearch = useEditorStore((state) => state.assetSearch);
  const selectAsset = useEditorStore((state) => state.selectAsset);
  const setAssetViewMode = useEditorStore((state) => state.setAssetViewMode);
  const setAssetSearch = useEditorStore((state) => state.setAssetSearch);
  const removeAsset = useEditorStore((state) => state.removeAsset);
  const setStatus = useEditorStore((state) => state.setStatus);

  const assets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return project.assets.filter(
      (asset) => !query || asset.name.toLowerCase().includes(query) || asset.relativePath.toLowerCase().includes(query),
    );
  }, [project.assets, assetSearch]);

  async function deleteAsset(asset: AssetDocument): Promise<void> {
    if (!window.confirm(`Remove ${asset.name} from the project?`)) return;
    try {
      if (projectPath) await deleteAssetFile(projectPath, asset.relativePath);
      removeAsset(asset.id);
    } catch (error) {
      setStatus(`Could not delete asset: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  async function reveal(asset: AssetDocument): Promise<void> {
    if (!projectPath) return;
    try {
      await revealAssetFile(projectPath, asset.relativePath);
    } catch (error) {
      setStatus(`Could not open asset folder: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  return (
    <div className="asset-browser-panel">
      <div className="bottom-tool-row">
        <div className="search-field">
          <Search size={15} />
          <input value={assetSearch} placeholder="Search assets" onChange={(event) => setAssetSearch(event.target.value)} />
        </div>
        <button className="material-button filled" type="button" onClick={onImport}>
          <Import size={15} /> Import Files
        </button>
        <button className="material-button tonal" type="button" onClick={onImportFolder}>
          <FolderOpen size={15} /> Import Folder
        </button>
        <div className="segmented-control">
          <button className={assetViewMode === "grid" ? "active" : ""} type="button" title="Grid view" onClick={() => setAssetViewMode("grid")}><Grid2X2 size={15} /></button>
          <button className={assetViewMode === "list" ? "active" : ""} type="button" title="List view" onClick={() => setAssetViewMode("list")}><List size={15} /></button>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="bottom-empty-state">
          <Image size={34} />
          <div><strong>No assets</strong><span>Import PNG, JPG, WebP, WAV, MP3, or OGG files. Imported files are copied into the project folder.</span></div>
          <div className="empty-state-actions">
            <button className="material-button tonal" type="button" onClick={onImport}><Import size={15} /> Import Assets</button>
            <button className="material-button text" type="button" onClick={onImportFolder}><FolderOpen size={15} /> Import Folder</button>
          </div>
        </div>
      ) : assetViewMode === "grid" ? (
        <div className="asset-grid">
          {assets.map((asset) => (
            <article
              key={asset.id}
              className={`asset-card ${selectedAssetId === asset.id ? "asset-card-selected" : ""}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-shadowium-asset-id", asset.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => selectAsset(asset.id)}
              onDoubleClick={() => asset.kind !== "audio" && onSlice(asset.id)}
            >
              <AssetThumbnail asset={asset} />
              <div className="asset-card-copy"><strong>{asset.name}</strong><small>{asset.kind === "audio" ? asset.mimeType : `${asset.width} × ${asset.height} · ${asset.frames.length} frame${asset.frames.length === 1 ? "" : "s"}`}</small></div>
              <div className="asset-card-actions">
                {asset.kind !== "audio" && <button type="button" title="Slice sprite sheet" onClick={(event) => { event.stopPropagation(); onSlice(asset.id); }}><Scissors size={14} /></button>}
                <button type="button" title="Reveal in folder" onClick={(event) => { event.stopPropagation(); void reveal(asset); }}><FolderOpen size={14} /></button>
                <button className="danger" type="button" title="Delete asset" onClick={(event) => { event.stopPropagation(); void deleteAsset(asset); }}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="asset-list">
          <div className="asset-list-header"><span>Name</span><span>Type</span><span>Dimensions</span><span>Frames</span><span /></div>
          {assets.map((asset) => (
            <div
              key={asset.id}
              className={`asset-list-row ${selectedAssetId === asset.id ? "asset-list-row-selected" : ""}`}
              draggable
              onDragStart={(event) => event.dataTransfer.setData("application/x-shadowium-asset-id", asset.id)}
              onClick={() => selectAsset(asset.id)}
              onDoubleClick={() => asset.kind !== "audio" && onSlice(asset.id)}
            >
              <span><AssetThumbnail asset={asset} className="asset-thumbnail-small" /><strong>{asset.name}</strong></span>
              <span>{asset.kind === "sprite-sheet" ? "Sprite sheet" : asset.kind === "audio" ? "Audio" : asset.kind === "tileset" ? "Tileset" : "Image"}</span>
              <span>{asset.kind === "audio" ? "—" : `${asset.width} × ${asset.height}`}</span>
              <span>{asset.frames.length}</span>
              <span className="row-actions">
                {asset.kind !== "audio" && <button type="button" onClick={(event) => { event.stopPropagation(); onSlice(asset.id); }}><Scissors size={14} /></button>}
                <button type="button" onClick={(event) => { event.stopPropagation(); void reveal(asset); }}><FolderOpen size={14} /></button>
                <button className="danger" type="button" onClick={(event) => { event.stopPropagation(); void deleteAsset(asset); }}><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
