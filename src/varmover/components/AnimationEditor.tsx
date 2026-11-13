import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Crosshair,
  Film,
  Link2,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { getAssetDataUrl } from "../editor/assets";
import { advanceAnimation, validateAnimationClip } from "../editor/animationRuntime";
import { createId } from "../editor/ids";
import { useEditorStore } from "../editor/store";
import type { AnimationClip, AnimationEventType, SpriteFrame } from "../editor/types";
import { CommitNumberField, CommitTextField, Switch } from "./EditorControls";

function FramePreview({ frame, dataUrl, size = 56 }: { frame: SpriteFrame; dataUrl: string | null; size?: number }) {
  const scale = Math.min(size / Math.max(1, frame.width), size / Math.max(1, frame.height));
  return (
    <div className="frame-preview" style={{ width: size, height: size }}>
      {dataUrl && (
        <div
          style={{
            width: frame.width,
            height: frame.height,
            backgroundImage: `url(${dataUrl})`,
            backgroundPosition: `-${frame.x}px -${frame.y}px`,
            backgroundRepeat: "no-repeat",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}

const EVENT_TYPES: AnimationEventType[] = ["emit-event", "play-sound", "enable-component", "disable-component", "spawn-prefab", "camera-shake", "set-variable"];

function ClipEditor({ clip }: { clip: AnimationClip }) {
  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const updateAnimation = useEditorStore((state) => state.updateAnimation);
  const deleteAnimation = useEditorStore((state) => state.deleteAnimation);
  const updateAssetFrame = useEditorStore((state) => state.updateAssetFrame);
  const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const playbackRef = useRef({ clipId: clip.id as string | null, frameIndex: 0, direction: 1 as 1 | -1, elapsedSeconds: 0 });

  useEffect(() => {
    if (!asset) { setDataUrl(null); return; }
    let active = true;
    void getAssetDataUrl(projectPath, asset).then((value) => { if (active) setDataUrl(value); });
    return () => { active = false; };
  }, [asset, projectPath]);

  useEffect(() => {
    playbackRef.current = { clipId: clip.id, frameIndex: 0, direction: 1, elapsedSeconds: 0 };
    setPreviewIndex(0);
    setSelectedFrameIndex(0);
  }, [clip.id]);

  useEffect(() => {
    if (!playing || clip.frames.length === 0) return;
    let frame = 0;
    let previous = performance.now();
    const loop = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000));
      previous = now;
      const next = advanceAnimation(clip, playbackRef.current, delta);
      playbackRef.current = { clipId: next.clipId, frameIndex: next.frameIndex, direction: next.direction, elapsedSeconds: next.elapsedSeconds };
      setPreviewIndex(next.frameIndex);
      if (!next.finished || clip.loop) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, clip]);

  const frameById = useMemo(() => new Map(asset?.frames.map((frame) => [frame.id, frame]) ?? []), [asset?.frames]);
  const previewReference = clip.frames[previewIndex % Math.max(1, clip.frames.length)];
  const previewFrame = frameById.get(previewReference?.frameId ?? "");
  const selectedReference = clip.frames[Math.max(0, Math.min(clip.frames.length - 1, selectedFrameIndex))];
  const selectedSourceFrame = frameById.get(selectedReference?.frameId ?? "");
  const problems = useMemo(() => validateAnimationClip(project, clip), [project, clip]);

  const references = useMemo(() => {
    const result: string[] = [];
    for (const scene of project.scenes) {
      for (const object of scene.objects) {
        for (const component of object.components) {
          if (Object.values(component.settings).some((value) => value === clip.id)) result.push(`${scene.name} › ${object.name} › ${component.type}`);
        }
      }
    }
    for (const set of project.animationSets) {
      if (Object.values(set.directions).includes(clip.id) || Object.values(set.states ?? {}).some((state) => Object.values(state).includes(clip.id))) result.push(`Animation Set › ${set.name}`);
    }
    return [...new Set(result)];
  }, [project, clip.id]);

  if (!asset) return <div className="bottom-empty-state"><Film size={30} /><div><strong>Missing source asset</strong><span>This clip references an asset that no longer exists.</span></div></div>;

  const moveFrame = (from: number, to: number) => {
    if (to < 0 || to >= clip.frames.length || from === to) return;
    const frames = [...clip.frames];
    const [moved] = frames.splice(from, 1);
    frames.splice(to, 0, moved);
    const remapIndex = (index: number) => {
      if (index === from) return to;
      if (from < to && index > from && index <= to) return index - 1;
      if (from > to && index >= to && index < from) return index + 1;
      return index;
    };
    updateAnimation(clip.id, { frames, events: clip.events.map((event) => ({ ...event, frameIndex: remapIndex(event.frameIndex) })) });
    setSelectedFrameIndex(to);
  };

  return (
    <div className="animation-editor-layout phase11-animation-editor">
      <aside className="clip-settings-panel">
        <div className="animation-preview-card">
          {previewFrame ? <FramePreview frame={previewFrame} dataUrl={dataUrl} size={140} /> : <Film size={42} />}
          <button className="animation-play-button" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <small>{clip.frames.length ? `Frame ${previewIndex + 1} / ${clip.frames.length}` : "No frames"}</small>
        </div>

        {problems.length > 0 && <div className="animation-problems"><CircleAlert size={16} /><div><strong>{problems.length} clip problem{problems.length === 1 ? "" : "s"}</strong>{problems.map((problem) => <span key={problem}>{problem}</span>)}</div></div>}
        <label className="stacked-field"><span>Clip Name</span><CommitTextField value={clip.name} onCommit={(name) => updateAnimation(clip.id, { name })} /></label>
        <label className="stacked-field"><span>Category</span><CommitTextField value={clip.category} onCommit={(category) => updateAnimation(clip.id, { category })} /></label>
        <label className="stacked-field"><span>Tags</span><CommitTextField value={clip.tags.join(", ")} onCommit={(value) => updateAnimation(clip.id, { tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label>
        <label className="stacked-field"><span>Frames Per Second</span><CommitNumberField value={clip.framesPerSecond} minimum={1} maximum={120} onCommit={(framesPerSecond) => updateAnimation(clip.id, { framesPerSecond })} /></label>
        <div className="setting-switch-row"><span>Loop</span><Switch checked={clip.loop} onChange={(loop) => updateAnimation(clip.id, { loop })} /></div>
        <div className="setting-switch-row"><span>Ping Pong</span><Switch checked={clip.pingPong} onChange={(pingPong) => updateAnimation(clip.id, { pingPong })} /></div>
        <label className="stacked-field"><span>Root Motion</span><select value={clip.rootMotionMode} onChange={(event) => updateAnimation(clip.id, { rootMotionMode: event.target.value as AnimationClip["rootMotionMode"] })}><option value="ignore">Ignore</option><option value="apply-position">Apply Position</option><option value="extract-only">Extract Only</option></select></label>
        <button className="material-button text danger-text" type="button" onClick={() => deleteAnimation(clip.id)}><Trash2 size={15} /> Delete Clip</button>
      </aside>

      <main className="clip-timeline-panel">
        <header><div><h3>Timeline</h3><span>{clip.frames.length} frames · {asset.name}</span></div></header>
        <div className="clip-frame-strip phase11-timeline">
          {clip.frames.map((reference, index) => {
            const frame = frameById.get(reference.frameId);
            if (!frame) return <div key={`${reference.frameId}-${index}`} className="timeline-frame broken"><CircleAlert size={18} /><span>Missing {reference.frameId}</span></div>;
            return (
              <div key={`${reference.frameId}-${index}`} className={`timeline-frame ${previewIndex === index ? "timeline-frame-active" : ""} ${selectedFrameIndex === index ? "selected" : ""}`} onClick={() => { setPreviewIndex(index); setSelectedFrameIndex(index); playbackRef.current = { clipId: clip.id, frameIndex: index, direction: 1, elapsedSeconds: 0 }; }}>
                <FramePreview frame={frame} dataUrl={dataUrl} />
                <span>{index + 1}</span>
                <div className="timeline-duration" onClick={(event) => event.stopPropagation()}>
                  <CommitNumberField value={reference.durationMs} minimum={16} maximum={60000} step={10} onCommit={(durationMs) => updateAnimation(clip.id, { frames: clip.frames.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, durationMs } : candidate) })} />
                  <small>ms</small>
                </div>
                <div className="timeline-frame-actions">
                  <button type="button" title="Move earlier" disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveFrame(index, index - 1); }}><ArrowUp size={11} /></button>
                  <button type="button" title="Move later" disabled={index === clip.frames.length - 1} onClick={(event) => { event.stopPropagation(); moveFrame(index, index + 1); }}><ArrowDown size={11} /></button>
                  <button type="button" title="Remove frame" onClick={(event) => { event.stopPropagation(); updateAnimation(clip.id, { frames: clip.frames.filter((_, candidateIndex) => candidateIndex !== index), events: clip.events.filter((event) => event.frameIndex !== index).map((event) => ({ ...event, frameIndex: event.frameIndex > index ? event.frameIndex - 1 : event.frameIndex })) }); }}><Trash2 size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedReference && selectedSourceFrame && (
          <section className="phase11-frame-details">
            <header><div><h3>Frame {selectedFrameIndex + 1}</h3><span>{selectedSourceFrame.name} · root motion and attachment sockets</span></div></header>
            <div className="phase11-frame-detail-grid">
              <label><span>Root Motion X</span><CommitNumberField value={Number(selectedReference.rootMotionX ?? 0)} minimum={-4096} maximum={4096} onCommit={(rootMotionX) => updateAnimation(clip.id, { frames: clip.frames.map((frame, index) => index === selectedFrameIndex ? { ...frame, rootMotionX } : frame) })} /></label>
              <label><span>Root Motion Y</span><CommitNumberField value={Number(selectedReference.rootMotionY ?? 0)} minimum={-4096} maximum={4096} onCommit={(rootMotionY) => updateAnimation(clip.id, { frames: clip.frames.map((frame, index) => index === selectedFrameIndex ? { ...frame, rootMotionY } : frame) })} /></label>
            </div>
            <div className="phase11-socket-editor">
              <header><strong><Crosshair size={14} /> Sprite Sockets</strong><button type="button" onClick={() => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: [...(selectedSourceFrame.sockets ?? []), { id: createId("socket"), name: `Socket ${(selectedSourceFrame.sockets?.length ?? 0) + 1}`, x: selectedSourceFrame.width / 2, y: selectedSourceFrame.height / 2, rotation: 0 }] })}><Plus size={13} /> Add Socket</button></header>
              {(selectedSourceFrame.sockets ?? []).map((socket) => <div key={socket.id} className="phase11-socket-row">
                <CommitTextField value={socket.name} onCommit={(name) => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: (selectedSourceFrame.sockets ?? []).map((candidate) => candidate.id === socket.id ? { ...candidate, name } : candidate) })} />
                <label>X <CommitNumberField value={socket.x} minimum={-4096} maximum={4096} onCommit={(x) => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: (selectedSourceFrame.sockets ?? []).map((candidate) => candidate.id === socket.id ? { ...candidate, x } : candidate) })} /></label>
                <label>Y <CommitNumberField value={socket.y} minimum={-4096} maximum={4096} onCommit={(y) => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: (selectedSourceFrame.sockets ?? []).map((candidate) => candidate.id === socket.id ? { ...candidate, y } : candidate) })} /></label>
                <label>° <CommitNumberField value={socket.rotation} minimum={-360} maximum={360} onCommit={(rotation) => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: (selectedSourceFrame.sockets ?? []).map((candidate) => candidate.id === socket.id ? { ...candidate, rotation } : candidate) })} /></label>
                <button type="button" onClick={() => updateAssetFrame(asset.id, selectedSourceFrame.id, { sockets: (selectedSourceFrame.sockets ?? []).filter((candidate) => candidate.id !== socket.id) })}><Trash2 size={12} /></button>
              </div>)}
              {(selectedSourceFrame.sockets ?? []).length === 0 && <span className="muted-row">No sockets on this frame. Add one for weapons, hats, muzzle flashes, or effects.</span>}
            </div>
          </section>
        )}

        <section className="phase11-animation-events">
          <header><div><h3><Radio size={15} /> Animation Events</h3><span>Events execute when playback enters their assigned frame.</span></div><button type="button" onClick={() => updateAnimation(clip.id, { events: [...clip.events, { id: createId("animation-event"), name: "Animation Event", frameIndex: Math.max(0, selectedFrameIndex), type: "emit-event", targetId: "", key: "", value: null }] })}><Plus size={13} /> Add Event</button></header>
          {clip.events.map((event) => <div key={event.id} className="animation-event-row">
            <CommitTextField value={event.name} onCommit={(name) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, name } : candidate) })} />
            <label>Frame <CommitNumberField value={event.frameIndex + 1} minimum={1} maximum={Math.max(1, clip.frames.length)} onCommit={(frame) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, frameIndex: Math.max(0, frame - 1) } : candidate) })} /></label>
            <select value={event.type} onChange={(change) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, type: change.target.value as AnimationEventType } : candidate) })}>{EVENT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/-/g, " ")}</option>)}</select>
            <input value={event.targetId} placeholder="Target / asset / prefab ID" onChange={(change) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, targetId: change.target.value } : candidate) })} />
            <input value={event.key} placeholder="Key / component ID" onChange={(change) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, key: change.target.value } : candidate) })} />
            <input value={event.value === null ? "" : String(event.value)} placeholder="Value" onChange={(change) => updateAnimation(clip.id, { events: clip.events.map((candidate) => candidate.id === event.id ? { ...candidate, value: change.target.value } : candidate) })} />
            <button type="button" onClick={() => updateAnimation(clip.id, { events: clip.events.filter((candidate) => candidate.id !== event.id) })}><Trash2 size={12} /></button>
          </div>)}
          {clip.events.length === 0 && <span className="muted-row">No animation events yet.</span>}
        </section>

        <header className="available-frames-header"><div><h3>Available Frames</h3><span>Click a source frame to append it to the clip.</span></div></header>
        <div className="available-frame-grid">
          {asset.frames.map((frame) => <button key={frame.id} type="button" title={frame.name} onClick={() => updateAnimation(clip.id, { frames: [...clip.frames, { frameId: frame.id, durationMs: Math.round(1000 / Math.max(1, clip.framesPerSecond)), rootMotionX: 0, rootMotionY: 0 }] })}><FramePreview frame={frame} dataUrl={dataUrl} /><span>{frame.name}</span><Plus size={12} /></button>)}
        </div>

        <section className="animation-reference-panel">
          <header><h3><Link2 size={14} /> References</h3><span>{references.length} use{references.length === 1 ? "" : "s"}</span></header>
          {references.map((reference) => <div key={reference}>{reference}</div>)}
          {references.length === 0 && <span className="muted-row">This clip is currently unused.</span>}
        </section>
      </main>
    </div>
  );
}

export function AnimationEditor() {
  const project = useEditorStore((state) => state.project);
  const selectedAnimationId = useEditorStore((state) => state.selectedAnimationId);
  const selectedAssetId = useEditorStore((state) => state.selectedAssetId);
  const selectAnimation = useEditorStore((state) => state.selectAnimation);
  const createAnimation = useEditorStore((state) => state.createAnimation);
  const [search, setSearch] = useState("");
  const selected = project.animations.find((clip) => clip.id === selectedAnimationId) ?? project.animations[0];
  const visibleClips = project.animations.filter((clip) => `${clip.name} ${clip.category} ${clip.tags.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="animation-workspace phase11-animation-library">
      <aside className="animation-clip-list">
        <header><span>Animation Library</span><button className="icon-button compact" type="button" title="Create clip from selected asset" disabled={!selectedAssetId} onClick={() => selectedAssetId && createAnimation(selectedAssetId)}><Plus size={14} /></button></header>
        <label className="animation-library-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clips…" /></label>
        {visibleClips.map((clip) => {
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          const problems = validateAnimationClip(project, clip);
          return <button key={clip.id} className={selected?.id === clip.id ? "active" : ""} type="button" onClick={() => selectAnimation(clip.id)}><Film size={14} /><span><strong>{clip.name}</strong><small>{asset?.name ?? "Missing asset"} · {clip.frames.length} frames</small></span>{problems.length ? <CircleAlert size={13} className="clip-warning" /> : <small>{clip.category}</small>}</button>;
        })}
        {project.animations.length === 0 && <div className="mini-empty"><Film size={25} /><span>No clips yet. Slice a sprite sheet and create an animation.</span></div>}
        <div className="animation-set-library"><header><span>Animation Sets</span><small>{project.animationSets.length}</small></header>{project.animationSets.map((set) => <div key={set.id}><Tag size={12} /><span>{set.name}</span><small>{Object.keys(set.states ?? { default: set.directions }).length} states</small></div>)}</div>
      </aside>
      <section className="animation-editor-main">{selected ? <ClipEditor clip={selected} /> : <div className="bottom-empty-state"><Film size={34} /><div><strong>No animation clip selected</strong><span>Select an imported sprite sheet and create a clip.</span></div></div>}</section>
    </div>
  );
}
