import { useEffect, useState } from "react";
import { BookOpen, Boxes, Film, Lightbulb, Map, Package, Plus, ShieldCheck, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { COMPONENT_CATALOG } from "../editor/catalog";
import { useEditorStore } from "../editor/store";
import type { ComponentSlot, ComponentType } from "../editor/types";
import { CommitNumberField, CommitTextField } from "./EditorControls";

export function ProductionToolkit() {
  const project = useEditorStore((state) => state.project);
  const addDialogueGraph = useEditorStore((state) => state.addDialogueGraph);
  const updateDialogueGraph = useEditorStore((state) => state.updateDialogueGraph);
  const addDialogueNode = useEditorStore((state) => state.addDialogueNode);
  const updateDialogueNode = useEditorStore((state) => state.updateDialogueNode);
  const deleteDialogueNode = useEditorStore((state) => state.deleteDialogueNode);
  const addDialogueChoice = useEditorStore((state) => state.addDialogueChoice);
  const updateDialogueChoice = useEditorStore((state) => state.updateDialogueChoice);
  const deleteDialogueChoice = useEditorStore((state) => state.deleteDialogueChoice);
  const addQuest = useEditorStore((state) => state.addQuest);
  const updateQuest = useEditorStore((state) => state.updateQuest);
  const addQuestObjective = useEditorStore((state) => state.addQuestObjective);
  const updateQuestObjective = useEditorStore((state) => state.updateQuestObjective);
  const deleteQuestObjective = useEditorStore((state) => state.deleteQuestObjective);
  const applyGenreKit = useEditorStore((state) => state.applyGenreKit);
  const addPackageManifest = useEditorStore((state) => state.addPackageManifest);
  const togglePackage = useEditorStore((state) => state.togglePackage);
  const addCustomGameObjectType = useEditorStore((state) => state.addCustomGameObjectType);
  const updateCustomGameObjectType = useEditorStore((state) => state.updateCustomGameObjectType);
  const deleteCustomGameObjectType = useEditorStore((state) => state.deleteCustomGameObjectType);
  const [tab, setTab] = useState<"types" | "animation" | "story" | "world" | "kits" | "packages" | "quality">("types");
  const [customTypeId, setCustomTypeId] = useState(project.customGameObjectTypes[0]?.id ?? "");
  const [dialogueId, setDialogueId] = useState(project.dialogues[0]?.id ?? "");
  const [questId, setQuestId] = useState(project.quests[0]?.id ?? "");

  useEffect(() => {
    if (dialogueId && project.dialogues.some((dialogue) => dialogue.id === dialogueId)) return;
    setDialogueId(project.dialogues[0]?.id ?? "");
  }, [dialogueId, project.dialogues]);
  useEffect(() => {
    if (questId && project.quests.some((quest) => quest.id === questId)) return;
    setQuestId(project.quests[0]?.id ?? "");
  }, [project.quests, questId]);
  useEffect(() => {
    if (customTypeId && project.customGameObjectTypes.some((definition) => definition.id === customTypeId)) return;
    setCustomTypeId(project.customGameObjectTypes[0]?.id ?? "");
  }, [customTypeId, project.customGameObjectTypes]);

  const dialogue = project.dialogues.find((candidate) => candidate.id === dialogueId) ?? null;
  const quest = project.quests.find((candidate) => candidate.id === questId) ?? null;
  const customType = project.customGameObjectTypes.find((candidate) => candidate.id === customTypeId) ?? null;

  const tabs = [
    ["types", <Boxes size={15}/>, "Object Types"],
    ["animation", <Film size={15}/>, "Animation & Cinematics"],
    ["story", <BookOpen size={15}/>, "Story & Gameplay"],
    ["world", <Map size={15}/>, "World Production"],
    ["kits", <Boxes size={15}/>, "Genre Kits"],
    ["packages", <Package size={15}/>, "Packages"],
    ["quality", <ShieldCheck size={15}/>, "Quality Rules"],
  ] as const;

  return <div className="phase10-production-toolkit">
    <header className="phase10-tool-hero"><span><WandSparkles size={26}/></span><div><h2>Production Toolkit</h2><p>Author complete systems without flattening the project into one universal Component list.</p></div></header>
    <nav className="phase10-tool-tabs">{tabs.map(([id,icon,label]) => <button key={id} className={tab===id?"active":""} type="button" onClick={()=>setTab(id)}>{icon}{label}</button>)}</nav>
    <div className="phase10-production-body">
      {tab === "types" && <div className="phase10-authoring-columns">
        <section className="phase10-authoring-studio">
          <header><div><Boxes size={18}/><span><strong>Project Game Object Types</strong><small>Create project-specific types that keep Component recommendations ordered.</small></span></div><button className="material-button tonal" type="button" onClick={() => { addCustomGameObjectType(); queueMicrotask(() => { const items = useEditorStore.getState().project.customGameObjectTypes; setCustomTypeId(items[items.length - 1]?.id ?? ""); }); }}><Plus size={14}/> New Type</button></header>
          {project.customGameObjectTypes.length > 0 && <select className="material-select" value={customTypeId} onChange={(event)=>setCustomTypeId(event.target.value)}>{project.customGameObjectTypes.map((definition)=><option key={definition.id} value={definition.id}>{definition.name}</option>)}</select>}
          {customType ? <div className="phase10-custom-type-editor">
            <label><span>Name</span><CommitTextField value={customType.name} onCommit={(name)=>updateCustomGameObjectType(customType.id,{name})}/></label>
            <label className="phase10-textarea-field"><span>Description</span><textarea defaultValue={customType.description} onBlur={(event)=>updateCustomGameObjectType(customType.id,{description:event.currentTarget.value})}/></label>
            <label><span>Recommended Components</span><CommitTextField value={customType.recommended.join(", ")} placeholder="sprite-renderer, health" onCommit={(value)=>updateCustomGameObjectType(customType.id,{recommended:value.split(",").map((entry)=>entry.trim()).filter((entry): entry is ComponentType => COMPONENT_CATALOG.some((definition)=>definition.type===entry))})}/></label>
            <label><span>Required Components</span><CommitTextField value={customType.required.join(", ")} placeholder="box-collider" onCommit={(value)=>updateCustomGameObjectType(customType.id,{required:value.split(",").map((entry)=>entry.trim()).filter((entry): entry is ComponentType => COMPONENT_CATALOG.some((definition)=>definition.type===entry))})}/></label>
            <div className="phase10-slot-picker"><strong>Inspector Slots</strong>{(["rendering","physics","input","movement","gameplay","combat","ai","abilities","camera","audio","interface","effects","persistence","scripting","debugging"] as ComponentSlot[]).map((slot)=><label key={slot}><input type="checkbox" checked={customType.slots.includes(slot)} onChange={(event)=>updateCustomGameObjectType(customType.id,{slots:event.target.checked?[...customType.slots,slot]:customType.slots.filter((value)=>value!==slot)})}/>{slot}</label>)}</div>
            <button className="material-button text danger" type="button" onClick={()=>deleteCustomGameObjectType(customType.id)}><Trash2 size={14}/> Delete Type</button>
          </div>:<div className="compact-empty"><Boxes size={28}/><strong>No custom types</strong><span>Built-in Character, Enemy, Camera, UI, Surface, and other types remain available automatically.</span></div>}
        </section>
        <section className="phase10-production-hero vertical"><ShieldCheck size={22}/><div><strong>Why types exist</strong><p>A type decides which Component slots and recommendations are shown by default. Advanced mode can still add unusual Components deliberately, so organization never removes flexibility.</p></div></section>
      </div>}

      {tab === "animation" && <>
        <section className="phase10-production-hero"><Film size={22}/><div><strong>Animation State Architecture</strong><p>Directional Animation Sets, state-machine Components, animation layers, and cutscene timelines are separate authoring concepts and run through the same animation runtime.</p></div></section>
        <div className="phase10-production-grid">
          <article><h3>Animation Sets</h3><strong>{project.animationSets.length}</strong><p>Directional mappings created directly from Sprite & Atlas Studio. Assign a set inside an Animation State Machine state with <code>animationSetId</code>.</p></article>
          <article><h3>Animation Clips</h3><strong>{project.animations.length}</strong><p>Frame clips remain reusable assets and can feed directional sets or explicit state-machine states.</p></article>
          <article><h3>State Machine Component</h3><Sparkles size={20}/><p>Transitions understand moving, idle, grounded, airborne, health thresholds, AI states, speed, and project variables.</p></article>
          <article><h3>Cutscene Timeline</h3><Film size={20}/><p>Camera, transform, animation, dialogue, audio, UI, shader, event, and time-scale tracks share one serialized timeline Component.</p></article>
        </div>
      </>}

      {tab === "story" && <div className="phase10-authoring-columns">
        <section className="phase10-authoring-studio">
          <header><div><BookOpen size={18}/><span><strong>Dialogue Graph Studio</strong><small>Branching dialogue data consumed by Dialogue Controller Components at runtime.</small></span></div><button className="material-button tonal" type="button" onClick={() => { addDialogueGraph(); queueMicrotask(() => setDialogueId((() => { const items = useEditorStore.getState().project.dialogues; return items[items.length - 1]?.id ?? ""; })())); }}><Plus size={14}/> New</button></header>
          {project.dialogues.length > 0 && <select className="material-select" value={dialogueId} onChange={(event) => setDialogueId(event.target.value)}>{project.dialogues.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>}
          {dialogue ? <div className="phase10-dialogue-editor">
            <label><span>Name</span><CommitTextField value={dialogue.name} onCommit={(name)=>updateDialogueGraph(dialogue.id,{name})}/></label>
            <div className="phase10-node-list">
              {dialogue.nodes.map((node,index)=><article key={node.id} className={dialogue.startNodeId===node.id?"start-node":""}>
                <header><strong>Node {index+1}</strong><div><button type="button" className="material-button text" onClick={()=>updateDialogueGraph(dialogue.id,{startNodeId:node.id})}>{dialogue.startNodeId===node.id?"Start node":"Make start"}</button><button className="icon-button compact danger" type="button" onClick={()=>deleteDialogueNode(dialogue.id,node.id)}><Trash2 size={13}/></button></div></header>
                <label><span>Speaker</span><CommitTextField value={node.speaker} onCommit={(speaker)=>updateDialogueNode(dialogue.id,node.id,{speaker})}/></label>
                <label className="phase10-textarea-field"><span>Text</span><textarea defaultValue={node.text} onBlur={(event)=>updateDialogueNode(dialogue.id,node.id,{text:event.currentTarget.value})}/></label>
                <label><span>Next</span><select value={node.nextId ?? ""} onChange={(event)=>updateDialogueNode(dialogue.id,node.id,{nextId:event.target.value||null})}><option value="">End dialogue</option>{dialogue.nodes.filter((candidate)=>candidate.id!==node.id).map((candidate)=><option key={candidate.id} value={candidate.id}>Node {dialogue.nodes.indexOf(candidate)+1}: {candidate.text.slice(0,32)}</option>)}</select></label>
                <div className="phase10-choice-list"><header><strong>Choices</strong><button type="button" onClick={()=>addDialogueChoice(dialogue.id,node.id)}><Plus size={12}/> Add choice</button></header>{node.choices.map((choice)=><div key={choice.id}><CommitTextField value={choice.label} onCommit={(label)=>updateDialogueChoice(dialogue.id,node.id,choice.id,{label})}/><select value={choice.nextId ?? ""} onChange={(event)=>updateDialogueChoice(dialogue.id,node.id,choice.id,{nextId:event.target.value||null})}><option value="">End</option>{dialogue.nodes.map((candidate)=><option key={candidate.id} value={candidate.id}>Node {dialogue.nodes.indexOf(candidate)+1}</option>)}</select><CommitTextField value={choice.conditionKey} placeholder="condition variable" onCommit={(conditionKey)=>updateDialogueChoice(dialogue.id,node.id,choice.id,{conditionKey})}/><button className="icon-button compact danger" type="button" onClick={()=>deleteDialogueChoice(dialogue.id,node.id,choice.id)}><Trash2 size={12}/></button></div>)}</div>
              </article>)}
            </div>
            <button className="material-button tonal" type="button" onClick={()=>addDialogueNode(dialogue.id)}><Plus size={14}/> Add dialogue node</button>
          </div>:<div className="compact-empty"><BookOpen size={28}/><strong>No Dialogue Graphs</strong><span>Create a graph, then attach Dialogue Controller to an Interactable or Character.</span></div>}
        </section>

        <section className="phase10-authoring-studio">
          <header><div><ShieldCheck size={18}/><span><strong>Quest Studio</strong><small>Objectives, rewards, and follow-up quests remain ordinary project data.</small></span></div><button className="material-button tonal" type="button" onClick={() => { addQuest(); queueMicrotask(() => setQuestId((() => { const items = useEditorStore.getState().project.quests; return items[items.length - 1]?.id ?? ""; })())); }}><Plus size={14}/> New</button></header>
          {project.quests.length > 0 && <select className="material-select" value={questId} onChange={(event)=>setQuestId(event.target.value)}>{project.quests.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>}
          {quest ? <div className="phase10-quest-editor">
            <label><span>Name</span><CommitTextField value={quest.name} onCommit={(name)=>updateQuest(quest.id,{name})}/></label>
            <label className="phase10-textarea-field"><span>Description</span><textarea defaultValue={quest.description} onBlur={(event)=>updateQuest(quest.id,{description:event.currentTarget.value})}/></label>
            <label><span>Reward Table</span><select value={quest.rewardTableId} onChange={(event)=>updateQuest(quest.id,{rewardTableId:event.target.value})}><option value="">No reward table</option>{project.lootTables.map((table)=><option key={table.id} value={table.id}>{table.name}</option>)}</select></label>
            <div className="phase10-objective-list"><header><strong>Objectives</strong><button type="button" onClick={()=>addQuestObjective(quest.id)}><Plus size={12}/> Add objective</button></header>{quest.objectives.map((objective,index)=><article key={objective.id}><strong>{index+1}</strong><select value={objective.kind} onChange={(event)=>updateQuestObjective(quest.id,objective.id,{kind:event.target.value as typeof objective.kind})}>{["reach","defeat","collect","speak","interact","survive","event"].map((kind)=><option key={kind} value={kind}>{kind}</option>)}</select><CommitTextField value={objective.targetId} placeholder="target / tag / event" onCommit={(targetId)=>updateQuestObjective(quest.id,objective.id,{targetId})}/><CommitNumberField value={objective.amount} minimum={1} onCommit={(amount)=>updateQuestObjective(quest.id,objective.id,{amount})}/><label className="phase10-inline-check"><input type="checkbox" checked={objective.optional} onChange={(event)=>updateQuestObjective(quest.id,objective.id,{optional:event.target.checked})}/> Optional</label><button className="icon-button compact danger" type="button" onClick={()=>deleteQuestObjective(quest.id,objective.id)}><Trash2 size={12}/></button></article>)}</div>
          </div>:<div className="compact-empty"><ShieldCheck size={28}/><strong>No Quests</strong><span>Create a quest and track it with a Quest Tracker Component.</span></div>}
        </section>
      </div>}

      {tab === "world" && <>
        <div className="phase10-production-grid">
          <article><h3>Navigation Regions</h3><Map size={20}/><p>Mark walkable areas and travel cost using Navigation Region Components; Patrol Path stores ordered waypoint data for AI.</p></article>
          <article><h3>2D Lighting</h3><Lightbulb size={20}/><p>Point Light now renders in Scene and Play Mode. Ambient Light and Light Occluder Components establish scene-lighting data for later shadow baking.</p></article>
          <article><h3>Environment</h3><Sparkles size={20}/><p>Weather Zone carries rain, snow, fog, wind, storms, tint, and ambient-audio settings without hardcoding a genre.</p></article>
          <article><h3>Procedural-ready Brushes</h3><WandSparkles size={20}/><p>Tile stamps, weighted variants, object placement, and generated content remain editable scene data rather than irreversible output.</p></article>
        </div>
      </>}

      {tab === "kits" && <div className="phase10-kit-grid">{project.genreKits.map((kit)=><article key={kit.id}><Sparkles size={18}/><div><strong>{kit.name}</strong><p>{kit.description}</p><small>{kit.recipeIds.length} linked recipes · UI theme {kit.uiThemeId}</small></div><button className="material-button tonal" type="button" onClick={()=>applyGenreKit(kit.id)}>Apply to Project</button></article>)}</div>}

      {tab === "packages" && <>
        <section className="phase10-production-hero"><Package size={22}/><div><strong>Project-local Package Architecture</strong><p>Package manifests declare Components, Game Object Recipes, themes, and dependencies. Package state is project-local and recoverable.</p></div><button className="material-button tonal" type="button" onClick={addPackageManifest}><Plus size={14}/> New Manifest</button></section>
        {project.packages.length===0?<div className="compact-empty"><Package size={28}/><strong>No project packages installed</strong><span>Create a local manifest or add package import support later without giving packages silent process access.</span></div>:<div className="phase10-kit-grid">{project.packages.map(pkg=><article key={pkg.id}><Package size={18}/><div><strong>{pkg.name} {pkg.version}</strong><p>{pkg.description}</p><small>{pkg.dependencies.length} dependencies · {pkg.componentTypes.length} Components</small></div><button className={`material-button ${pkg.enabled?"tonal":"text"}`} type="button" onClick={()=>togglePackage(pkg.id)}>{pkg.enabled?"Enabled":"Disabled"}</button></article>)}</div>}
      </>}

      {tab === "quality" && <div className="phase10-quality-list">
        {["Game Object has an explicit Type","Components declare a purpose slot","Recommended Components are scoped by Game Object Type","Dependencies are added automatically","Advanced combinations remain possible but are labelled","Game Object Recipes expose normal Components","Empty projects remain empty","Themes for the editor and the game are separate","Preview and export use the same serialized settings","Every new Component must define editor/runtime/serialization/diagnostic behaviour","Camera targeting uses Game Object references rather than fragile text names","Sprite frame selection is directly interactive and persists only selected frames"].map((rule,index)=><div key={rule}><span>{index+1}</span><strong>{rule}</strong></div>)}
      </div>}
    </div>
  </div>;
}
