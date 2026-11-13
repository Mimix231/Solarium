import { useEffect, useMemo, useState } from "react";
import { Brush, Eraser, Eye, EyeOff, Grid3X3, Image, Layers3, Lock, MousePointer2, PaintBucket, Pipette, Plus, Stamp, Trash2, Unlock } from "lucide-react";
import { getAssetDataUrl } from "../editor/assets";
import { createId } from "../editor/ids";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type { AssetDocument, SpriteFrame, TilePaletteEntry } from "../editor/types";
import { AssetFrameThumbnail, AssetThumbnail } from "./AssetBrowser";
import { CommitNumberField, CommitTextField, Switch } from "./EditorControls";

const COLLISION_OPTIONS: Array<{ label: string; value: TilePaletteEntry["collision"] }> = [
  { label: "No collision", value: "none" },
  { label: "Solid", value: "solid" },
  { label: "Trigger", value: "trigger" },
];

function TilesetAtlasPicker({ asset }: { asset: AssetDocument }) {
  const projectPath = useEditorStore((state) => state.projectPath);
  const addTilesetFrames = useEditorStore((state) => state.addTilesetFrames);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(asset.tileWidth ?? 32);
  const [cellHeight, setCellHeight] = useState(asset.tileHeight ?? 32);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [draggingSelection, setDraggingSelection] = useState(false);

  useEffect(() => {
    let active = true;
    void getAssetDataUrl(projectPath, asset).then((value) => { if (active) setDataUrl(value); });
    return () => { active = false; };
  }, [asset, projectPath]);


  useEffect(() => {
    const finish = () => setDraggingSelection(false);
    window.addEventListener("pointerup", finish);
    window.addEventListener("blur", finish);
    return () => { window.removeEventListener("pointerup", finish); window.removeEventListener("blur", finish); };
  }, []);

  const columns = Math.max(1, Math.floor(asset.width / Math.max(1, cellWidth)));
  const rows = Math.max(1, Math.floor(asset.height / Math.max(1, cellHeight)));
  const startColumn = Math.min(selectionStart % columns, selectionEnd % columns);
  const endColumn = Math.max(selectionStart % columns, selectionEnd % columns);
  const startRow = Math.min(Math.floor(selectionStart / columns), Math.floor(selectionEnd / columns));
  const endRow = Math.max(Math.floor(selectionStart / columns), Math.floor(selectionEnd / columns));
  const selectedColumns = endColumn - startColumn + 1;
  const selectedRows = endRow - startRow + 1;
  const selectedIndexes = useMemo(() => {
    const values: number[] = [];
    for (let row = startRow; row <= endRow; row += 1) for (let column = startColumn; column <= endColumn; column += 1) values.push(row * columns + column);
    return new Set(values);
  }, [columns, endColumn, endRow, startColumn, startRow]);

  function addSelection(): void {
    const frames: SpriteFrame[] = [];
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        frames.push({
          id: createId("frame"),
          name: `Tile ${column},${row}`,
          x: column * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
          pivotX: 0.5,
          pivotY: 0.5,
        });
      }
    }
    addTilesetFrames(asset.id, frames, selectedColumns, selectedRows);
  }

  return (
    <section className="tileset-atlas-studio">
      <header><div><Grid3X3 size={15} /><span><strong>Tileset Atlas</strong><small>Drag across exact grid cells, or click one cell, to select a rectangular tile stamp.</small></span></div><span>{columns} × {rows}</span></header>
      <div className="tileset-atlas-controls">
        <label><span>Cell W</span><CommitNumberField value={cellWidth} minimum={1} maximum={asset.width} onCommit={(value) => { setCellWidth(value); setSelectionStart(0); setSelectionEnd(0); }} /></label>
        <label><span>Cell H</span><CommitNumberField value={cellHeight} minimum={1} maximum={asset.height} onCommit={(value) => { setCellHeight(value); setSelectionStart(0); setSelectionEnd(0); }} /></label>
        <span>{selectedColumns} × {selectedRows} selected</span>
        <button className="material-button filled" type="button" onClick={addSelection}><Stamp size={14} /> Use as tile brush</button>
      </div>
      <div className="tileset-atlas-scroll">
        {dataUrl ? (
          <div className="tileset-atlas-image" style={{ width: asset.width, height: asset.height }}>
            <img src={dataUrl} alt={asset.name} draggable={false} />
            {Array.from({ length: columns * rows }, (_, index) => {
              const column = index % columns;
              const row = Math.floor(index / columns);
              return <button key={index} type="button" className={selectedIndexes.has(index) ? "selected" : ""} style={{ left: column * cellWidth, top: row * cellHeight, width: cellWidth, height: cellHeight }} title={`Tile ${column},${row} · source ${column * cellWidth},${row * cellHeight}`} onPointerDown={(event) => { event.preventDefault(); if (event.shiftKey) setSelectionEnd(index); else { setSelectionStart(index); setSelectionEnd(index); } setDraggingSelection(true); }} onPointerEnter={() => { if (draggingSelection) setSelectionEnd(index); }}><span>{column},{row}</span></button>;
            })}
          </div>
        ) : <div className="compact-empty"><Image size={24} /><span>Loading tileset image…</span></div>}
      </div>
      <p><MousePointer2 size={13} /> A 32 × 32 cell selects exactly that source rectangle. A larger rectangular selection becomes a reusable multi-tile stamp.</p>
    </section>
  );
}

export function WorldBuilderPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedAssetId = useEditorStore((state) => state.selectedAssetId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const selectedTileBrush = useEditorStore((state) => state.selectedTileBrush);
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectAsset = useEditorStore((state) => state.selectAsset);
  const addTilemapObject = useEditorStore((state) => state.addTilemapObject);
  const setSelectedTile = useEditorStore((state) => state.setSelectedTile);
  const setSelectedTileBrush = useEditorStore((state) => state.setSelectedTileBrush);
  const fillTilemap = useEditorStore((state) => state.fillTilemap);
  const addTilesFromAsset = useEditorStore((state) => state.addTilesFromAsset);
  const addColorTile = useEditorStore((state) => state.addColorTile);
  const updateTilePaletteEntry = useEditorStore((state) => state.updateTilePaletteEntry);
  const deleteTilePaletteEntry = useEditorStore((state) => state.deleteTilePaletteEntry);
  const addSceneLayer = useEditorStore((state) => state.addSceneLayer);
  const updateSceneLayer = useEditorStore((state) => state.updateSceneLayer);
  const deleteSceneLayer = useEditorStore((state) => state.deleteSceneLayer);

  const scene = getActiveScene(project);
  const tilemaps = scene.objects.filter((object) => object.components.some((element) => element.type === "tilemap-renderer"));
  const selectedTilemap = tilemaps.find((object) => object.id === selectedObjectId) ?? null;
  const tilemapElement = selectedTilemap?.components.find((element) => element.type === "tilemap-renderer");
  const selectedTile = project.tilePalette.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedTileAsset = selectedTile ? project.assets.find((asset) => asset.id === selectedTile.assetId) ?? null : null;
  const availableTilesetAssets = project.assets.filter((asset) => asset.kind !== "audio");
  const paletteAsset = availableTilesetAssets.find((asset) => asset.id === selectedAssetId) ?? availableTilesetAssets[0] ?? null;

  let paintedCellCount = 0;
  try { paintedCellCount = Object.keys(JSON.parse(String(tilemapElement?.settings.cells ?? "{}"))).length; } catch { paintedCellCount = 0; }

  function deleteSelectedTile(): void {
    if (!selectedTile) return;
    if (!window.confirm(`Delete palette tile “${selectedTile.name}”? Painted instances of this tile will also be removed.`)) return;
    deleteTilePaletteEntry(selectedTile.id);
  }

  return (
    <div className="world-builder-panel phase7-tilemap-studio">
      <section className="world-builder-column layer-column">
        <header className="phase-panel-header"><div><Layers3 size={16} /><span>Scene Layers</span></div><button className="icon-button" type="button" title="Add scene layer" onClick={addSceneLayer}><Plus size={15} /></button></header>
        <div className="scene-layer-list">
          {[...scene.layers].sort((a, b) => a.renderOrder - b.renderOrder).map((layer) => (
            <article key={layer.id} className="scene-layer-row">
              <span className="layer-color" style={{ background: layer.editorColor }} />
              <div className="scene-layer-main"><CommitTextField value={layer.name} onCommit={(name) => updateSceneLayer(layer.id, { name })} /><small>Order {layer.renderOrder} · Parallax {layer.parallaxX.toFixed(2)}, {layer.parallaxY.toFixed(2)}</small></div>
              <button className="icon-button compact" type="button" title={layer.visible ? "Hide layer" : "Show layer"} onClick={() => updateSceneLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
              <button className="icon-button compact" type="button" title={layer.locked ? "Unlock layer" : "Lock layer"} onClick={() => updateSceneLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
              {scene.layers.length > 1 && <button className="icon-button compact danger" type="button" title="Delete layer" onClick={() => deleteSceneLayer(layer.id)}><Trash2 size={13} /></button>}
            </article>
          ))}
        </div>
      </section>

      <section className="world-builder-column tilemap-column">
        <header className="phase-panel-header"><div><Grid3X3 size={16} /><span>Tilemaps</span></div><button className="material-button tonal" type="button" onClick={addTilemapObject}><Plus size={14} /> Tilemap</button></header>
        <div className="tilemap-list">
          {tilemaps.map((object) => {
            const element = object.components.find((candidate) => candidate.type === "tilemap-renderer");
            return <button key={object.id} type="button" className={object.id === selectedObjectId ? "active" : ""} onClick={() => selectObject(object.id)}><Grid3X3 size={15} /><span><strong>{object.name}</strong><small>{Number(element?.settings.mapWidth ?? 32)} × {Number(element?.settings.mapHeight ?? 24)} tiles</small></span></button>;
          })}
          {tilemaps.length === 0 && <div className="compact-empty"><Grid3X3 size={24} /><span>Create a tilemap to begin painting the world.</span></div>}
        </div>
        {selectedTilemap && tilemapElement && <div className="tilemap-settings-row"><label><span>Tile W</span><CommitNumberField value={Number(tilemapElement.settings.tileWidth ?? 32)} minimum={4} maximum={512} onCommit={(value) => useEditorStore.getState().updateComponentSetting(tilemapElement.id, "tileWidth", value)} /></label><label><span>Tile H</span><CommitNumberField value={Number(tilemapElement.settings.tileHeight ?? 32)} minimum={4} maximum={512} onCommit={(value) => useEditorStore.getState().updateComponentSetting(tilemapElement.id, "tileHeight", value)} /></label><span className="painted-count">{paintedCellCount} painted</span><button className="material-button text danger" type="button" onClick={() => fillTilemap(selectedTilemap.id, null)}>Clear</button></div>}
      </section>

      <section className="world-builder-column palette-column">
        <header className="phase-panel-header"><div><Brush size={16} /><span>Tileset & Brush</span></div><div className="tile-tool-strip"><button className={activeTool === "tile-paint" ? "active" : ""} type="button" title="Paint" onClick={() => setActiveTool("tile-paint")}><Brush size={14} /></button><button className={activeTool === "tile-erase" ? "active" : ""} type="button" title="Erase" onClick={() => setActiveTool("tile-erase")}><Eraser size={14} /></button><button className={activeTool === "tile-fill" ? "active" : ""} type="button" title="Fill" onClick={() => setActiveTool("tile-fill")}><PaintBucket size={14} /></button><button className={activeTool === "tile-picker" ? "active" : ""} type="button" title="Pick tile" onClick={() => setActiveTool("tile-picker")}><Pipette size={14} /></button></div></header>

        <div className="tileset-import-row"><select className="material-input" value={paletteAsset?.id ?? ""} disabled={availableTilesetAssets.length === 0} onChange={(event) => selectAsset(event.target.value || null)}>{availableTilesetAssets.length === 0 && <option value="">Import an image to begin</option>}{availableTilesetAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.width} × {asset.height}</option>)}</select><button className="material-button tonal" type="button" disabled={!paletteAsset || paletteAsset.frames.length === 0} onClick={() => { if (paletteAsset) addTilesFromAsset(paletteAsset.id); }}><Image size={14} /> Add saved frames</button><button className="material-button text" type="button" onClick={addColorTile}><Plus size={14} /> Colour</button></div>

        {paletteAsset ? <TilesetAtlasPicker key={paletteAsset.id} asset={paletteAsset} /> : <div className="compact-empty"><Image size={28} /><strong>No tileset image</strong><span>Import a PNG and select it here. Slicing it first is optional.</span></div>}

        <div className="active-brush-summary"><Stamp size={15} /><span><strong>Active brush</strong><small>{selectedTileBrush.columns} × {selectedTileBrush.rows} · {selectedTileBrush.tileIds.length} tile{selectedTileBrush.tileIds.length === 1 ? "" : "s"}</small></span>{selectedTileBrush.tileIds.length > 1 && <button className="material-button text" type="button" onClick={() => setSelectedTileBrush(selectedTileId ? [selectedTileId] : [], 1, 1)}>Single tile</button>}</div>

        <div className="tile-palette-grid">
          {project.tilePalette.map((tile) => {
            const asset = project.assets.find((candidate) => candidate.id === tile.assetId);
            return <button key={tile.id} type="button" className={selectedTileId === tile.id ? "active" : ""} title={`${tile.name} · ${tile.collision} collision`} onClick={() => setSelectedTile(tile.id)}>{asset && tile.frameId ? <AssetFrameThumbnail asset={asset} frameId={tile.frameId} className="tile-palette-thumbnail" /> : asset ? <AssetThumbnail asset={asset} className="tile-palette-thumbnail" /> : <span style={{ background: tile.color }} />}<small>{tile.name}</small>{tile.terrainType && <em title={`Terrain ${tile.terrainType}, mask ${tile.terrainMask ?? "base"}`}>{tile.terrainMask ?? "•"}</em>}</button>;
          })}
          {project.tilePalette.length === 0 && <div className="compact-empty"><Brush size={24} /><span>Select atlas cells above to create an exact tile brush.</span></div>}
        </div>

        {selectedTile && <div className="tile-palette-editor"><div className="tile-palette-editor-heading"><div className="tile-preview-large">{selectedTileAsset && selectedTile.frameId ? <AssetFrameThumbnail asset={selectedTileAsset} frameId={selectedTile.frameId} /> : selectedTileAsset ? <AssetThumbnail asset={selectedTileAsset} /> : <span style={{ background: selectedTile.color }} />}</div><div><strong>Tile properties</strong><small>{selectedTileAsset ? "Image-backed atlas cell" : "Colour-backed tile"}</small></div><button className="icon-button compact danger" type="button" title="Delete tile" onClick={deleteSelectedTile}><Trash2 size={14} /></button></div><label><span>Name</span><CommitTextField value={selectedTile.name} onCommit={(name) => updateTilePaletteEntry(selectedTile.id, { name })} /></label><div className="tile-property-grid"><label><span>Fallback colour</span><input className="material-input tile-color-input" type="color" value={selectedTile.color} onChange={(event) => updateTilePaletteEntry(selectedTile.id, { color: event.target.value })} /></label><label><span>Collision</span><select className="material-input" value={selectedTile.collision} onChange={(event) => updateTilePaletteEntry(selectedTile.id, { collision: event.target.value as TilePaletteEntry["collision"] })}>{COLLISION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Terrain type</span><CommitTextField value={selectedTile.terrainType ?? ""} placeholder="grass, water, wall…" onCommit={(terrainType) => updateTilePaletteEntry(selectedTile.id, { terrainType })} /></label><label><span>Terrain mask</span><CommitNumberField value={selectedTile.terrainMask ?? -1} minimum={-1} maximum={15} onCommit={(terrainMask) => updateTilePaletteEntry(selectedTile.id, { terrainMask: terrainMask < 0 ? null : terrainMask })} /></label></div></div>}

        <div className="world-builder-hint"><Switch checked={Boolean(tilemapElement?.settings.collisionEnabled ?? false)} onChange={(value) => { if (tilemapElement) useEditorStore.getState().updateComponentSetting(tilemapElement.id, "collisionEnabled", value); }} /><span>Use palette collision while playing</span></div>
      </section>
    </div>
  );
}
