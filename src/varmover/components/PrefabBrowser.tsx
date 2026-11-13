import { useMemo, useState } from "react";
import { Box, Plus, Save, Search, Trash2, Copy } from "lucide-react";
import { getComponentDefinition } from "../editor/catalog";
import { useEditorStore } from "../editor/store";
import type { PrefabDocument } from "../editor/types";

function prefabCategory(template: PrefabDocument): string {
  if (template.category) return template.category;
  const first = template.object?.components?.[0];
  if (!first) return "custom";
  try {
    return getComponentDefinition(first.type).category;
  } catch {
    return "custom";
  }
}

export function PrefabBrowser() {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const addObjectFromPrefab = useEditorStore((state) => state.addObjectFromPrefab);
  const saveSelectedAsPrefab = useEditorStore((state) => state.saveSelectedAsPrefab);
  const deletePrefab = useEditorStore((state) => state.deletePrefab);
  const createPrefabVariant = useEditorStore((state) => state.createPrefabVariant);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const prefabs = useMemo(
    () => (Array.isArray(project.prefabs) ? project.prefabs : []).filter((template): template is PrefabDocument => Boolean(template?.id && template?.object && Array.isArray(template.object.components))),
    [project.prefabs],
  );

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const template of prefabs) values.add(prefabCategory(template));
    return [...values].sort();
  }, [prefabs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prefabs.filter((template) => {
      if (category !== "all" && prefabCategory(template) !== category) return false;
      if (!query) return true;
      return `${template.name} ${template.description ?? ""} ${template.object.components.map((component) => component.type).join(" ")}`.toLowerCase().includes(query);
    });
  }, [prefabs, search, category]);

  return (
    <div className="template-browser-panel phase5-element-library">
      <div className="bottom-tool-row element-library-toolbar">
        <div className="panel-intro">
          <Box size={16} />
          <span>Game Object Recipes</span>
          <small>{filtered.length} of {prefabs.length}</small>
        </div>
        <label className="element-library-search">
          <Search size={14} />
          <input value={search} placeholder="Search movement, doors, physics, UI…" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button
          className="material-button tonal"
          type="button"
          disabled={!selectedObjectId}
          onClick={saveSelectedAsPrefab}
        >
          <Save size={15} /> Save Selected As Game Object
        </button>
      </div>

      <nav className="game-object-category-strip" aria-label="Game Object categories">
        <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>All</button>
        {categories.map((value) => (
          <button key={value} type="button" className={category === value ? "active" : ""} onClick={() => setCategory(value)}>
            {value.replace(/(^|-)(\w)/g, (_match, prefix: string, letter: string) => `${prefix ? " " : ""}${letter.toUpperCase()}`)}
          </button>
        ))}
      </nav>

      <div className="template-grid phase5-template-grid">
        {filtered.map((template) => (
          <article
            key={template.id}
            className="template-card"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-shadowium-template-id", template.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            <div className="template-card-symbol" style={{ background: template.object.editorColor }}>
              <Box size={24} />
            </div>
            <div className="template-card-copy">
              <div className="template-card-title-row">
                <strong>{template.name}</strong>
                {template.builtIn && <span className="template-badge">Built-in</span>}
                {template.variantOf && <span className="template-badge variant">Variant</span>}
              </div>
              <p>{template.description}</p>
              <div className="template-element-tags">
                {template.object.components.slice(0, 5).map((element) => <code key={element.id}>{element.type}</code>)}
                {template.object.components.length > 5 && <small>+{template.object.components.length - 5}</small>}
              </div>
            </div>
            <div className="template-card-actions">
              <button className="material-button filled" type="button" onClick={() => addObjectFromPrefab(template.id)}>
                <Plus size={15} /> Add
              </button>
              <button className="icon-button" type="button" title="Create Prefab Variant" onClick={() => createPrefabVariant(template.id)}><Copy size={15} /></button>
              {!template.builtIn && (
                <button className="icon-button danger" type="button" title="Delete Game Object" onClick={() => deletePrefab(template.id)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </article>
        ))}
        {filtered.length === 0 && <div className="element-library-empty"><Search size={26} /><strong>No matching Game Objects</strong><span>Try another name or category.</span></div>}
      </div>
    </div>
  );
}
