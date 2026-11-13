import { Copy, Palette, Sparkles, Monitor, Smartphone, Gamepad2 } from "lucide-react";
import { useEditorStore } from "../editor/store";
import { CommitNumberField, CommitTextField } from "./EditorControls";

export function ThemeStudio() {
  const project = useEditorStore((state) => state.project);
  const setActiveEditorTheme = useEditorStore((state) => state.setActiveEditorTheme);
  const duplicateEditorTheme = useEditorStore((state) => state.duplicateEditorTheme);
  const updateEditorTheme = useEditorStore((state) => state.updateEditorTheme);
  const setActiveGameUiTheme = useEditorStore((state) => state.setActiveGameUiTheme);
  const duplicateGameUiTheme = useEditorStore((state) => state.duplicateGameUiTheme);
  const updateGameUiTheme = useEditorStore((state) => state.updateGameUiTheme);
  const editorTheme = project.editorThemes.find((theme) => theme.id === project.activeEditorThemeId) ?? project.editorThemes[0];
  const gameTheme = project.gameUiThemes.find((theme) => theme.id === project.activeGameUiThemeId) ?? project.gameUiThemes[0];

  if (!editorTheme || !gameTheme) return <div className="compact-empty"><Palette size={28} /><span>No themes are available.</span></div>;

  return (
    <div className="phase10-theme-studio">
      <header className="phase10-tool-hero"><span><Palette size={26} /></span><div><h2>Theme Studio</h2><p>Editor appearance and the game UI theme are separate systems. Edit either without changing the other.</p></div></header>
      <div className="phase10-theme-columns">
        <section className="phase10-theme-card">
          <header><div><Sparkles size={18} /><span><strong>ShadowiumUI Editor Theme</strong><small>Changes the authoring application only.</small></span></div><div className="theme-picker-actions"><select value={editorTheme.id} onChange={(event) => setActiveEditorTheme(event.target.value)}>{project.editorThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select><button className="icon-button" type="button" title="Duplicate as editable theme" onClick={() => duplicateEditorTheme(editorTheme.id)}><Copy size={15} /></button></div></header>
          <div className="theme-token-grid">
            {(["accent","secondaryAccent","background","surface","raisedSurface","text","mutedText"] as const).map((key) => <label key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><div><input type="color" value={editorTheme[key]} onChange={(event) => updateEditorTheme(editorTheme.id, { [key]: event.target.value })} /><code>{editorTheme[key]}</code></div></label>)}
            <label><span>Corner Radius</span><CommitNumberField value={editorTheme.radius} minimum={0} maximum={40} onCommit={(radius) => updateEditorTheme(editorTheme.id,{radius})} /></label>
            <label><span>Backdrop Blur</span><CommitNumberField value={editorTheme.blur} minimum={0} maximum={48} onCommit={(blur) => updateEditorTheme(editorTheme.id,{blur})} /></label>
            <label><span>Motion Scale</span><CommitNumberField value={editorTheme.motionScale} minimum={0} maximum={2} step={0.1} onCommit={(motionScale) => updateEditorTheme(editorTheme.id,{motionScale})} /></label>
            <label><span>Density</span><select value={editorTheme.density} onChange={(event) => updateEditorTheme(editorTheme.id,{density:event.target.value as typeof editorTheme.density})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="touch">Touch</option></select></label>
          </div>
          <div className="theme-live-preview" style={{ background: editorTheme.background, color: editorTheme.text, borderRadius: editorTheme.radius }}><div style={{ background: editorTheme.surface }}><strong>Hierarchy</strong><span style={{ background: editorTheme.raisedSurface }}>Player</span><span>Camera</span></div><main style={{ background: editorTheme.surface }}><button style={{ background: editorTheme.accent }}>Primary</button><button style={{ borderColor: editorTheme.secondaryAccent }}>Tonal</button><p style={{ color: editorTheme.mutedText }}>Live authoring preview</p></main></div>
        </section>

        <section className="phase10-theme-card">
          <header><div><Gamepad2 size={18} /><span><strong>Game UI Theme</strong><small>Used by menus, HUDs, dialogue, and interface controls.</small></span></div><div className="theme-picker-actions"><select value={gameTheme.id} onChange={(event) => setActiveGameUiTheme(event.target.value)}>{project.gameUiThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select><button className="icon-button" type="button" title="Duplicate as editable game UI theme" onClick={() => duplicateGameUiTheme(gameTheme.id)}><Copy size={15} /></button></div></header>
          <div className="theme-token-grid">
            <label><span>Font Family</span><CommitTextField value={gameTheme.fontFamily} onCommit={(fontFamily) => updateGameUiTheme(gameTheme.id,{fontFamily})} /></label>
            {(["textColor","accentColor","panelColor","buttonColor","selectedColor","selectedBackground"] as const).map((key) => <label key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><div><input type="color" value={gameTheme[key].slice(0,7)} onChange={(event) => updateGameUiTheme(gameTheme.id,{[key]:event.target.value})} /><code>{gameTheme[key]}</code></div></label>)}
            <label><span>Corner Radius</span><CommitNumberField value={gameTheme.cornerRadius} minimum={0} maximum={64} onCommit={(cornerRadius) => updateGameUiTheme(gameTheme.id,{cornerRadius})} /></label>
            <label><span>Spacing</span><CommitNumberField value={gameTheme.spacing} minimum={0} maximum={64} onCommit={(spacing) => updateGameUiTheme(gameTheme.id,{spacing})} /></label>
            <label><span>Transition</span><CommitTextField value={gameTheme.transition} onCommit={(transition) => updateGameUiTheme(gameTheme.id,{transition})} /></label>
          </div>
          <div className="game-ui-theme-preview" style={{ background: gameTheme.panelColor, color: gameTheme.textColor, borderRadius: gameTheme.cornerRadius, fontFamily: gameTheme.fontFamily }}><span className="device-preview-label"><Monitor size={14}/> Menu Preview</span><h3>Pause</h3><button style={{ background: gameTheme.selectedBackground, color: gameTheme.selectedColor, borderRadius: gameTheme.cornerRadius }}>Resume</button><button style={{ background: gameTheme.buttonColor, color: gameTheme.textColor, borderRadius: gameTheme.cornerRadius }}>Options</button><button style={{ background: gameTheme.buttonColor, color: gameTheme.textColor, borderRadius: gameTheme.cornerRadius }}>Quit</button><footer><Smartphone size={14}/> Responsive theme tokens</footer></div>
        </section>
      </div>
    </div>
  );
}
