import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare2, Grid3X3, MousePointer2, PanelTop, Play, Scissors, SquareDashed, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { getAssetDataUrl, sliceAssetGrid } from "../editor/assets";
import { createId } from "../editor/ids";
import { useEditorStore } from "../editor/store";
import type { SpriteFrame } from "../editor/types";
import { AssetThumbnail } from "./AssetBrowser";
import { CommitNumberField, CommitTextField } from "./EditorControls";

interface ManualDrag {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function SpriteSheetEditor({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setAssetFrames = useEditorStore((state) => state.setAssetFrames);
  const setAssetScalingRegion = useEditorStore((state) => state.setAssetScalingRegion);
  const commitFramesAndCreateAnimation = useEditorStore((state) => state.commitFramesAndCreateAnimation);
  const createDirectionalAnimationSet = useEditorStore((state) => state.createDirectionalAnimationSet);
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  const [mode, setMode] = useState<"grid" | "manual" | "scaling">("grid");
  const [frameWidth, setFrameWidth] = useState(asset?.frames[0]?.width ?? 32);
  const [frameHeight, setFrameHeight] = useState(asset?.frames[0]?.height ?? 32);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [selectionOrder, setSelectionOrder] = useState<"selection" | "grid">("selection");
  const [animationName, setAnimationName] = useState("Walk");
  const [animationFps, setAnimationFps] = useState(8);
  const [createdClipId, setCreatedClipId] = useState<string | null>(null);
  const [collisionGeneration, setCollisionGeneration] = useState<"none" | "box" | "alpha-hull">("none");
  const selectionAnchorRef = useRef<number | null>(null);
  const [manualFrames, setManualFrames] = useState<SpriteFrame[]>([]);
  const [manualDrag, setManualDrag] = useState<ManualDrag | null>(null);
  const [gridDrag, setGridDrag] = useState<ManualDrag | null>(null);
  const gridDragAdditiveRef = useRef(false);
  const suppressGridClickRef = useRef(false);
  const [detecting, setDetecting] = useState(false);
  const [scalingRegion, setScalingRegion] = useState(() => asset?.scalingRegion ?? { left: 8, top: 8, right: 8, bottom: 8, centerMode: "stretch" as const, edgeMode: "stretch" as const });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!asset) {
      setDataUrl(null);
      return;
    }
    let active = true;
    void getAssetDataUrl(projectPath, asset).then((value) => { if (active) setDataUrl(value); });
    return () => { active = false; };
  }, [asset, projectPath]);

  const previewFrames = useMemo(
    () => (asset ? sliceAssetGrid(asset, frameWidth, frameHeight, margin, spacing) : []),
    [asset, frameWidth, frameHeight, margin, spacing],
  );

  useEffect(() => {
    setSelectedIndexes((current) => current.filter((index) => index < previewFrames.length));
  }, [previewFrames.length]);

  useEffect(() => {
    if (mode !== "grid") return;
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") { event.preventDefault(); setSelectedIndexes(previewFrames.map((_, index) => index)); }
      if (event.key === "Escape") setSelectedIndexes([]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, previewFrames]);

  if (!asset) return null;
  const activeAsset = asset;

  const orderedSelectedIndexes = selectionOrder === "grid" ? [...selectedIndexes].sort((a, b) => a - b) : selectedIndexes;
  const selectedGridFrames = orderedSelectedIndexes.map((index, order) => {
    const frame = previewFrames[index];
    return frame ? { ...frame, name: `Frame ${order + 1}` } : null;
  }).filter((frame): frame is SpriteFrame => Boolean(frame));
  const outputFrames = mode === "grid" ? selectedGridFrames : mode === "manual" ? manualFrames : [];

  function selectGridFrame(index: number, event: React.MouseEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (suppressGridClickRef.current) return;

    const additive = event.ctrlKey || event.metaKey;
    const rangeSelection = event.shiftKey && selectionAnchorRef.current !== null;
    setSelectedIndexes((current) => {
      if (rangeSelection) {
        const anchor = selectionAnchorRef.current ?? index;
        const minimum = Math.min(anchor, index);
        const maximum = Math.max(anchor, index);
        const range = Array.from({ length: maximum - minimum + 1 }, (_, offset) => minimum + offset);
        return additive ? Array.from(new Set([...current, ...range])) : range;
      }
      selectionAnchorRef.current = index;
      if (additive) return current.includes(index) ? current.filter((value) => value !== index) : [...current, index];
      return [index];
    });
  }

  function imagePoint(event: React.PointerEvent): { x: number; y: number } | null {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.min(activeAsset.width, (event.clientX - bounds.left) / zoom)),
      y: Math.max(0, Math.min(activeAsset.height, (event.clientY - bounds.top) / zoom)),
    };
  }

  function beginGridSelection(event: React.PointerEvent<HTMLDivElement>): void {
    if (mode !== "grid" || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-slice-cell='true']")) return;
    const point = imagePoint(event);
    if (!point) return;
    gridDragAdditiveRef.current = event.ctrlKey || event.metaKey || event.shiftKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    setGridDrag({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function updateGridSelection(event: React.PointerEvent<HTMLDivElement>): void {
    if (mode !== "grid" || !gridDrag) return;
    const point = imagePoint(event);
    if (point) setGridDrag((current) => current ? { ...current, currentX: point.x, currentY: point.y } : current);
  }

  function finishGridSelection(event: React.PointerEvent<HTMLDivElement>): void {
    if (mode !== "grid" || !gridDrag) return;
    const point = imagePoint(event) ?? { x: gridDrag.currentX, y: gridDrag.currentY };
    const left = Math.min(gridDrag.startX, point.x);
    const right = Math.max(gridDrag.startX, point.x);
    const top = Math.min(gridDrag.startY, point.y);
    const bottom = Math.max(gridDrag.startY, point.y);
    const moved = Math.hypot(point.x - gridDrag.startX, point.y - gridDrag.startY) > 3 / Math.max(zoom, 0.001);
    if (moved) {
      suppressGridClickRef.current = true;
      window.setTimeout(() => { suppressGridClickRef.current = false; }, 0);
      const hitIndexes = previewFrames.flatMap((frame, index) => {
        const intersects = frame.x < right && frame.x + frame.width > left && frame.y < bottom && frame.y + frame.height > top;
        return intersects ? [index] : [];
      });
      setSelectedIndexes((current) => gridDragAdditiveRef.current ? Array.from(new Set([...current, ...hitIndexes])) : hitIndexes);
      if (hitIndexes.length) selectionAnchorRef.current = hitIndexes[hitIndexes.length - 1];
    } else if (!gridDragAdditiveRef.current) {
      setSelectedIndexes([]);
      selectionAnchorRef.current = null;
    }
    setGridDrag(null);
  }

  function beginManual(event: React.PointerEvent<HTMLDivElement>): void {
    if (mode !== "manual" && mode !== "scaling") return;
    const point = imagePoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setManualDrag({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function updateManual(event: React.PointerEvent<HTMLDivElement>): void {
    if (!manualDrag || (mode !== "manual" && mode !== "scaling")) return;
    const point = imagePoint(event);
    if (point) setManualDrag({ ...manualDrag, currentX: point.x, currentY: point.y });
  }

  function finishManual(event: React.PointerEvent<HTMLDivElement>): void {
    if (!manualDrag || (mode !== "manual" && mode !== "scaling")) return;
    const point = imagePoint(event) ?? { x: manualDrag.currentX, y: manualDrag.currentY };
    const x = Math.round(Math.min(manualDrag.startX, point.x));
    const y = Math.round(Math.min(manualDrag.startY, point.y));
    const width = Math.round(Math.abs(point.x - manualDrag.startX));
    const height = Math.round(Math.abs(point.y - manualDrag.startY));
    if (width >= 2 && height >= 2) {
      if (mode === "scaling") {
        setScalingRegion((current) => ({
          ...current,
          left: x,
          top: y,
          right: Math.max(0, activeAsset.width - (x + width)),
          bottom: Math.max(0, activeAsset.height - (y + height)),
        }));
      } else {
        setManualFrames((frames) => [...frames, { id: createId("frame"), name: `Manual ${frames.length + 1}`, x, y, width, height, pivotX: 0.5, pivotY: 0.5 }]);
      }
    }
    setManualDrag(null);
  }

  async function detectTransparentRegions(): Promise<void> {
    if (!dataUrl) return;
    setDetecting(true);
    try {
      const image = new window.Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = activeAsset.width;
      canvas.height = activeAsset.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const visited = new Uint8Array(canvas.width * canvas.height);
      const regions: SpriteFrame[] = [];
      const alphaAt = (x: number, y: number) => pixels[(y * canvas.width + x) * 4 + 3];
      for (let startY = 0; startY < canvas.height; startY += 1) {
        for (let startX = 0; startX < canvas.width; startX += 1) {
          const startIndex = startY * canvas.width + startX;
          if (visited[startIndex] || alphaAt(startX, startY) <= 8) continue;
          visited[startIndex] = 1;
          const queueX = [startX];
          const queueY = [startY];
          let cursor = 0;
          let minimumX = startX;
          let maximumX = startX;
          let minimumY = startY;
          let maximumY = startY;
          let count = 0;
          while (cursor < queueX.length) {
            const x = queueX[cursor];
            const y = queueY[cursor];
            cursor += 1;
            count += 1;
            minimumX = Math.min(minimumX, x); maximumX = Math.max(maximumX, x);
            minimumY = Math.min(minimumY, y); maximumY = Math.max(maximumY, y);
            for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
              if (nextX < 0 || nextY < 0 || nextX >= canvas.width || nextY >= canvas.height) continue;
              const index = nextY * canvas.width + nextX;
              if (visited[index] || alphaAt(nextX, nextY) <= 8) continue;
              visited[index] = 1;
              queueX.push(nextX);
              queueY.push(nextY);
            }
          }
          if (count < 4) continue;
          regions.push({ id: createId("frame"), name: `Detected ${regions.length + 1}`, x: minimumX, y: minimumY, width: maximumX - minimumX + 1, height: maximumY - minimumY + 1, pivotX: 0.5, pivotY: 0.5 });
        }
      }
      setManualFrames(regions.sort((left, right) => left.y - right.y || left.x - right.x));
      setMode("manual");
    } finally {
      setDetecting(false);
    }
  }

  function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 3) return points;
    const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
    const cross = (origin: { x: number; y: number }, left: { x: number; y: number }, right: { x: number; y: number }) => (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
    const lower: { x: number; y: number }[] = [];
    for (const point of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
      lower.push(point);
    }
    const upper: { x: number; y: number }[] = [];
    for (const point of [...sorted].reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
      upper.push(point);
    }
    lower.pop(); upper.pop();
    return [...lower, ...upper];
  }

  async function framesWithCollision(frames: SpriteFrame[]): Promise<SpriteFrame[]> {
    if (collisionGeneration === "none") return frames;
    if (collisionGeneration === "box") return frames.map((frame) => ({ ...frame, collisionPolygon: [{ x: 0, y: 0 }, { x: frame.width, y: 0 }, { x: frame.width, y: frame.height }, { x: 0, y: frame.height }] }));
    if (!dataUrl) return frames;
    const image = new window.Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = activeAsset.width;
    canvas.height = activeAsset.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return frames;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alphaAt = (x: number, y: number) => pixels[(y * canvas.width + x) * 4 + 3] ?? 0;
    return frames.map((frame) => {
      const stride = Math.max(1, Math.floor(Math.max(frame.width, frame.height) / 48));
      const points: { x: number; y: number }[] = [];
      for (let localY = 0; localY < frame.height; localY += stride) {
        for (let localX = 0; localX < frame.width; localX += stride) {
          const sourceX = Math.min(canvas.width - 1, frame.x + localX);
          const sourceY = Math.min(canvas.height - 1, frame.y + localY);
          if (alphaAt(sourceX, sourceY) < 24) continue;
          const boundary = localX === 0 || localY === 0 || localX + stride >= frame.width || localY + stride >= frame.height
            || alphaAt(Math.max(frame.x, sourceX - stride), sourceY) < 24
            || alphaAt(Math.min(frame.x + frame.width - 1, sourceX + stride), sourceY) < 24
            || alphaAt(sourceX, Math.max(frame.y, sourceY - stride)) < 24
            || alphaAt(sourceX, Math.min(frame.y + frame.height - 1, sourceY + stride)) < 24;
          if (boundary) points.push({ x: localX, y: localY });
        }
      }
      const hull = convexHull(points);
      return { ...frame, collisionPolygon: hull.length >= 3 ? hull : [{ x: 0, y: 0 }, { x: frame.width, y: 0 }, { x: frame.width, y: frame.height }, { x: 0, y: frame.height }] };
    });
  }

  const dragRect = manualDrag ? {
    left: Math.min(manualDrag.startX, manualDrag.currentX),
    top: Math.min(manualDrag.startY, manualDrag.currentY),
    width: Math.abs(manualDrag.currentX - manualDrag.startX),
    height: Math.abs(manualDrag.currentY - manualDrag.startY),
  } : null;
  const gridDragRect = gridDrag ? {
    left: Math.min(gridDrag.startX, gridDrag.currentX),
    top: Math.min(gridDrag.startY, gridDrag.currentY),
    width: Math.abs(gridDrag.currentX - gridDrag.startX),
    height: Math.abs(gridDrag.currentY - gridDrag.startY),
  } : null;

  return (
    <div className="modal-scrim sprite-studio-scrim" onPointerDown={onClose}>
      <section className="material-dialog sprite-editor-dialog phase7-sprite-studio" onPointerDown={(event) => event.stopPropagation()}>
        <header className="dialog-header sprite-studio-header">
          <div><h2>Sprite & Atlas Studio</h2><p>{activeAsset.name} · {activeAsset.width} × {activeAsset.height} · visually choose the exact frames to create</p></div>
          <div className="sprite-studio-toolbar">
            <button className={mode === "grid" ? "active" : ""} type="button" onClick={() => setMode("grid")}><Grid3X3 size={15} /> Grid cells</button>
            <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => setMode("manual")}><SquareDashed size={15} /> Manual regions</button>
            <button className={mode === "scaling" ? "active" : ""} type="button" onClick={() => setMode("scaling")}><PanelTop size={15} /> Scaling regions</button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}><ZoomOut size={15} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.25))}><ZoomIn size={15} /></button>
            <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className="sprite-editor-layout">
          <div className="sprite-canvas-wrap phase7-sprite-canvas-wrap">
            {dataUrl ? (
              <div className="sprite-zoom-stage" style={{ width: activeAsset.width * zoom, height: activeAsset.height * zoom }}>
                <div
                  ref={canvasRef}
                  className={`sprite-sheet-preview interactive ${mode}`}
                  style={{ width: activeAsset.width, height: activeAsset.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                  onPointerDown={(event) => { beginGridSelection(event); beginManual(event); }}
                  onPointerMove={(event) => { updateGridSelection(event); updateManual(event); }}
                  onPointerUp={(event) => { finishGridSelection(event); finishManual(event); }}
                  onPointerCancel={() => { setGridDrag(null); setManualDrag(null); }}
                >
                  <img src={dataUrl} alt={activeAsset.name} draggable={false} />
                  {mode === "grid" && previewFrames.map((frame, index) => (
                    <button
                      key={`${frame.x}:${frame.y}:${index}`}
                      type="button"
                      data-slice-cell="true"
                      aria-pressed={selectedIndexes.includes(index)}
                      className={`slice-overlay selectable ${selectedIndexes.includes(index) ? "selected" : ""}`}
                      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
                      onPointerDown={(event) => { event.stopPropagation(); }}
                      onClick={(event) => selectGridFrame(index, event)}
                    >
                      <span>{selectedIndexes.includes(index) ? `${selectedIndexes.indexOf(index) + 1} · ${index + 1}` : index + 1}</span>
                    </button>
                  ))}
                  {mode === "manual" && manualFrames.map((frame, index) => (
                    <div key={frame.id} className="slice-overlay selected manual" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}><span>{index + 1}</span></div>
                  ))}
                  {mode === "scaling" && <div className="protected-region-overlay" style={{ left: scalingRegion.left, top: scalingRegion.top, right: scalingRegion.right, bottom: scalingRegion.bottom }}><span>Scalable region</span></div>}
                  {dragRect && <div className="manual-slice-drag" style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }} />}
                  {gridDragRect && <div className="grid-selection-drag" style={{ left: gridDragRect.left, top: gridDragRect.top, width: gridDragRect.width, height: gridDragRect.height }} />}
                </div>
              </div>
            ) : (
              <div className="sprite-loading"><AssetThumbnail asset={activeAsset} /><span>Loading image…</span></div>
            )}
          </div>

          <aside className="sprite-editor-settings phase7-sprite-settings">
            {mode === "grid" ? (
              <>
                <h3><Grid3X3 size={16} /> Uniform grid</h3>
                <label><span>Frame Width</span><CommitNumberField value={frameWidth} minimum={1} maximum={activeAsset.width} onCommit={setFrameWidth} /></label>
                <label><span>Frame Height</span><CommitNumberField value={frameHeight} minimum={1} maximum={activeAsset.height} onCommit={setFrameHeight} /></label>
                <label><span>Margin</span><CommitNumberField value={margin} minimum={0} onCommit={setMargin} /></label>
                <label><span>Spacing</span><CommitNumberField value={spacing} minimum={0} onCommit={setSpacing} /></label>
                <div className="sprite-selection-actions">
                  <button className="material-button tonal" type="button" onClick={() => setSelectedIndexes(previewFrames.map((_, index) => index))}><CheckSquare2 size={14} /> Select all</button>
                  <button className="material-button text" type="button" onClick={() => setSelectedIndexes([])}>Clear</button>
                </div>
                <label><span>Frame Order</span><select value={selectionOrder} onChange={(event) => setSelectionOrder(event.target.value as "selection" | "grid")}><option value="selection">Selection order</option><option value="grid">Grid order</option></select></label>
                <div className="sprite-row-shortcuts">
                  {[...new Set(previewFrames.map((frame) => frame.y))].slice(0, 12).map((rowY, rowIndex) => <button key={rowY} type="button" onClick={() => setSelectedIndexes(previewFrames.map((frame, index) => frame.y === rowY ? index : -1).filter((index) => index >= 0))}>Row {rowIndex + 1}</button>)}
                </div>
                <p className="studio-help"><MousePointer2 size={14} /> Click selects one cell. Ctrl-click toggles cells. Shift-click selects a range. Drag over the sheet to box-select cells. Ctrl+A selects all. Only highlighted cells become frames.</p>
              </>
            ) : mode === "manual" ? (
              <>
                <h3><SquareDashed size={16} /> Manual regions</h3>
                <p className="studio-help">Drag rectangles directly around irregular sprites, or let ShadowiumUI detect connected non-transparent regions.</p>
                <button className="material-button tonal full-width" type="button" disabled={!dataUrl || detecting} onClick={() => void detectTransparentRegions()}><SquareDashed size={14} /> {detecting ? "Detecting sprites…" : "Detect transparent sprites"}</button>
                <div className="manual-frame-list">
                  {manualFrames.map((frame) => <div key={frame.id}><span><CommitTextField value={frame.name} onCommit={(name) => setManualFrames((frames) => frames.map((candidate) => candidate.id === frame.id ? { ...candidate, name } : candidate))} /><small>{frame.x}, {frame.y} · {frame.width} × {frame.height}</small></span><button type="button" onClick={() => setManualFrames((frames) => frames.filter((candidate) => candidate.id !== frame.id))}><Trash2 size={13} /></button></div>)}
                  {manualFrames.length === 0 && <div className="compact-empty"><SquareDashed size={24} /><span>Drag over the sprite sheet to add a frame.</span></div>}
                </div>
              </>
            ) : (
              <>
                <h3><PanelTop size={16} /> Protected scaling region</h3>
                <p className="studio-help">Drag a box around the part allowed to expand. Everything outside stays visually fixed, which is ideal for dialogue boxes, RPG panels, buttons, and framed surfaces.</p>
                <label><span>Fixed Left</span><CommitNumberField value={scalingRegion.left} minimum={0} maximum={activeAsset.width} onCommit={(left) => setScalingRegion((region) => ({ ...region, left }))} /></label>
                <label><span>Fixed Top</span><CommitNumberField value={scalingRegion.top} minimum={0} maximum={activeAsset.height} onCommit={(top) => setScalingRegion((region) => ({ ...region, top }))} /></label>
                <label><span>Fixed Right</span><CommitNumberField value={scalingRegion.right} minimum={0} maximum={activeAsset.width} onCommit={(right) => setScalingRegion((region) => ({ ...region, right }))} /></label>
                <label><span>Fixed Bottom</span><CommitNumberField value={scalingRegion.bottom} minimum={0} maximum={activeAsset.height} onCommit={(bottom) => setScalingRegion((region) => ({ ...region, bottom }))} /></label>
                <label><span>Centre</span><select value={scalingRegion.centerMode} onChange={(event) => setScalingRegion((region) => ({ ...region, centerMode: event.target.value as typeof region.centerMode }))}><option value="stretch">Stretch</option><option value="tile">Tile</option><option value="solid">Solid fill</option></select></label>
                <label><span>Edges</span><select value={scalingRegion.edgeMode} onChange={(event) => setScalingRegion((region) => ({ ...region, edgeMode: event.target.value as typeof region.edgeMode }))}><option value="stretch">Stretch</option><option value="tile">Tile</option></select></label>
                <div className="protected-region-preview-grid">
                  <div><span>Original</span><i style={{ backgroundImage: dataUrl ? `url(${dataUrl})` : undefined }} /></div>
                  <div><span>Wide</span><i className="wide" style={{ backgroundImage: dataUrl ? `url(${dataUrl})` : undefined }} /></div>
                  <div><span>Tall</span><i className="tall" style={{ backgroundImage: dataUrl ? `url(${dataUrl})` : undefined }} /></div>
                </div>
                <button className="material-button filled full-width" type="button" onClick={() => setAssetScalingRegion(activeAsset.id, scalingRegion)}><PanelTop size={15} /> Save scaling region</button>
              </>
            )}
            {mode !== "scaling" && <>
              {mode === "grid" && selectedIndexes.length > 0 && <div className="phase10-selected-frame-list"><header><strong>Selected Frames</strong><small>{selectedIndexes.length}</small></header>{orderedSelectedIndexes.slice(0, 16).map((index, order) => { const frame = previewFrames[index]; return frame ? <div key={index}><span>{order + 1}. Cell {index + 1}</span><small>{frame.x},{frame.y} · {frame.width}×{frame.height}</small>{selectionOrder === "selection" && <span className="selected-frame-order-actions"><button type="button" disabled={order === 0} onClick={() => setSelectedIndexes((current) => { const position = current.indexOf(index); if (position <= 0) return current; const next = [...current]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; return next; })}>↑</button><button type="button" disabled={order >= orderedSelectedIndexes.length - 1} onClick={() => setSelectedIndexes((current) => { const position = current.indexOf(index); if (position < 0 || position >= current.length - 1) return current; const next = [...current]; [next[position + 1], next[position]] = [next[position], next[position + 1]]; return next; })}>↓</button></span>}</div> : null; })}{selectedIndexes.length > 16 && <small>+{selectedIndexes.length - 16} more</small>}</div>}
              <label><span>Frame Collision</span><select value={collisionGeneration} onChange={(event) => setCollisionGeneration(event.target.value as typeof collisionGeneration)}><option value="none">None</option><option value="box">Frame bounds</option><option value="alpha-hull">Alpha convex hull</option></select></label>
              <div className="slice-summary"><strong>{outputFrames.length}</strong><span>selected frame{outputFrames.length === 1 ? "" : "s"}</span></div>
              <button className="material-button filled full-width" type="button" disabled={outputFrames.length === 0} onClick={() => void framesWithCollision(outputFrames).then((frames) => setAssetFrames(activeAsset.id, frames))}><Scissors size={15} /> Apply selected frames</button>
              <button className="material-button tonal full-width" type="button" disabled={outputFrames.length === 0} onClick={() => void framesWithCollision(outputFrames).then((frames) => {
                const clipId = commitFramesAndCreateAnimation(activeAsset.id, frames, animationName.trim() || `${activeAsset.name.replace(/\.[^.]+$/, "")} Animation`, animationFps);
                setCreatedClipId(clipId);
              })}><Play size={15} /> Create animation clip</button>
              {createdClipId && <div className="sprite-created-clip"><strong>Animation clip created</strong><span>It is saved in Logic → Animations and can be assigned immediately.</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("shadowium:open-animation", { detail: { clipId: createdClipId } }))}>Open Animation Studio</button></div>}
              {mode === "grid" && <div className="phase10-direction-builder">
                <h4>Directional Animation Set</h4>
                <label><span>Name</span><input value={animationName} onChange={(event) => setAnimationName(event.target.value)} /></label>
                <label><span>FPS</span><CommitNumberField value={animationFps} minimum={1} maximum={60} onCommit={setAnimationFps} /></label>
                <p className="studio-help">Uses the first four selected grid rows as Down, Left, Right, Up and creates four clips plus one Animation Set asset.</p>
                <button className="material-button tonal full-width" type="button" disabled={outputFrames.length === 0} onClick={() => { createDirectionalAnimationSet(activeAsset.id, outputFrames, animationName.trim() || "Walk", animationFps); }}><Play size={15} /> Build directional set</button>
              </div>}
            </>}
          </aside>
        </div>

        <footer className="dialog-footer"><span>{activeAsset.frames.length} saved frame{activeAsset.frames.length === 1 ? "" : "s"}</span><span>Grid and manual frame data persist with the project.</span><button className="material-button text" type="button" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}
