import { Music, Plus, Volume2, VolumeX } from "lucide-react";
import { useEditorStore } from "../editor/store";

export function AudioPanel() {
  const project = useEditorStore((state) => state.project);
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings);
  const addObjectFromPrefab = useEditorStore((state) => state.addObjectFromPrefab);
  const audioTemplate = project.prefabs.find((template) => template.object.components.some((element) => element.type === "audio-source"));
  const audioAssets = project.assets.filter((asset) => asset.kind === "audio" || asset.mimeType.startsWith("audio/"));

  function updateGroup(id: string, patch: Partial<(typeof project.settings.audioGroups)[number]>): void {
    setProjectSettings({ audioGroups: project.settings.audioGroups.map((group) => group.id === id ? { ...group, ...patch } : group) });
  }

  return (
    <div className="audio-workspace-panel">
      <section className="audio-mixer">
        <header className="phase-panel-header"><div><Volume2 size={16} /><span>Audio Mixer</span></div>{audioTemplate && <button className="material-button tonal" type="button" onClick={() => addObjectFromPrefab(audioTemplate.id)}><Plus size={14} /> Audio Source</button>}</header>
        <div className="mixer-groups">
          {project.settings.audioGroups.map((group) => (
            <article key={group.id}>
              <button className={`icon-button ${group.muted ? "danger" : ""}`} type="button" title={group.muted ? "Unmute" : "Mute"} onClick={() => updateGroup(group.id, { muted: !group.muted })}>{group.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
              <div><strong>{group.name}</strong><small>{Math.round(group.volume * 100)}%</small></div>
              <input type="range" min="0" max="1" step="0.01" value={group.volume} onChange={(event) => updateGroup(group.id, { volume: Number(event.target.value) })} />
            </article>
          ))}
        </div>
      </section>
      <section className="audio-assets">
        <header className="phase-panel-header"><div><Music size={16} /><span>Imported Audio</span></div><small>WAV · MP3 · OGG</small></header>
        {audioAssets.length > 0 ? audioAssets.map((asset) => <div key={asset.id} className="audio-asset-row"><Music size={14} /><span>{asset.name}</span><small>{asset.mimeType}</small></div>) : <div className="compact-empty"><Music size={24} /><span>No audio imported yet. Use File → Import Assets.</span></div>}
      </section>
    </div>
  );
}
