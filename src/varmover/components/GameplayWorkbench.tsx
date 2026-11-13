import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Box,
  Braces,
  Bug,
  Coins,
  Crosshair,
  FlaskConical,
  HeartPulse,
  Layers3,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
} from "lucide-react";
import { COMPONENT_CATALOG } from "../editor/catalog";
import { compileLeonisScript, LEONIS_SCRIPT_SNIPPETS } from "../editor/leonisScript";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type {
  AbilityDefinition,
  BehaviourRecipeDefinition,
  ComponentCategory,
  LootTableDefinition,
  ScriptDefinition,
  StatusEffectDefinition,
} from "../editor/types";

type GameplayTab = "components" | "combat" | "ai" | "abilities" | "stats" | "progression" | "scripts" | "materials" | "debug";

const TAB_DEFINITIONS: Array<{ id: GameplayTab; label: string; icon: typeof Box }> = [
  { id: "components", label: "Components", icon: Box },
  { id: "combat", label: "Combat", icon: Swords },
  { id: "ai", label: "AI & Recipes", icon: Bot },
  { id: "abilities", label: "Abilities", icon: WandSparkles },
  { id: "stats", label: "Stats", icon: Activity },
  { id: "progression", label: "Progression", icon: Coins },
  { id: "scripts", label: "Shadowium Script", icon: Braces },
  { id: "materials", label: "Materials", icon: Sparkles },
  { id: "debug", label: "Runtime Debug", icon: Bug },
];

function SectionHeader({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <header className="phase8-section-header"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div>{action}</header>;
}

function NumericInput({ value, onChange, min, step = 1 }: { value: number; onChange: (value: number) => void; min?: number; step?: number }) {
  return <input type="number" value={Number.isFinite(value) ? value : 0} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} />;
}

function ComponentsPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const addComponent = useEditorStore((state) => state.addComponent);
  const object = getActiveScene(project).objects.find((candidate) => candidate.id === selectedObjectId);
  const grouped = useMemo(() => {
    const map = new Map<ComponentCategory, typeof COMPONENT_CATALOG>();
    for (const definition of COMPONENT_CATALOG) {
      const entries = map.get(definition.category) ?? [];
      entries.push(definition);
      map.set(definition.category, entries);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, []);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Box size={24} />} title="Component Framework" description="Components live inside Game Objects. Game Object recipes and Prefabs remain separate scene-building concepts." />
    <div className="phase8-summary-grid">
      <article><strong>{COMPONENT_CATALOG.length}</strong><span>Component types</span></article>
      <article><strong>{Array.isArray(project.prefabs) ? project.prefabs.length : 0}</strong><span>Game Object recipes and Prefabs</span></article>
      <article><strong>{object?.components.length ?? 0}</strong><span>Components on selection</span></article>
      <article><strong>{Array.isArray(project.behaviourRecipes) ? project.behaviourRecipes.length : 0}</strong><span>Behaviour recipes</span></article>
    </div>
    {!object && <div className="phase8-empty"><Layers3 size={28} /><strong>Select a Game Object</strong><span>Then attach Components here or through the Inspector.</span></div>}
    {object && <>
      <div className="phase8-selected-banner"><strong>{object.name}</strong><span>{object.components.length} attached Components</span></div>
      {grouped.map(([category, definitions]) => <section className="phase8-component-category" key={category}>
        <h3>{category}</h3>
        <div className="phase8-card-grid compact">
          {definitions.map((definition) => {
            const attached = object.components.some((component) => component.type === definition.type);
            return <button key={definition.type} type="button" className={`phase8-component-card ${attached ? "attached" : ""}`} onClick={() => !attached && addComponent(definition.type)}>
              <span style={{ background: definition.color }} />
              <div><strong>{definition.name}</strong><small>{definition.description}</small></div>
              <em>{attached ? "Attached" : "+ Add"}</em>
            </button>;
          })}
        </div>
      </section>)}
    </>}
  </div>;
}

function CombatPanel() {
  const project = useEditorStore((state) => state.project);
  const updateDamageType = useEditorStore((state) => state.updateDamageType);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Swords size={24} />} title="Combat Framework" description="Teams, Hitboxes, Hurtboxes, typed damage, shields, resistances, knockback, attacks, weapons, projectiles, and Death Behaviour use one damage pipeline." />
    <div className="phase8-pipeline"><span>Attack</span><i>→</i><span>Hitbox</span><i>→</i><span>Team filter</span><i>→</i><span>Resistance</span><i>→</i><span>Shield</span><i>→</i><span>Health</span><i>→</i><span>Death</span></div>
    <section className="phase8-editor-section"><h3>Damage types</h3><div className="phase8-table">
      {project.damageTypes.map((damageType) => <div className="phase8-table-row" key={damageType.id}>
        <input type="color" value={damageType.color} onChange={(event) => updateDamageType(damageType.id, { color: event.target.value })} />
        <input value={damageType.name} onChange={(event) => updateDamageType(damageType.id, { name: event.target.value })} />
        <code>{damageType.id}</code>
        <label><input type="checkbox" checked={damageType.healing} onChange={(event) => updateDamageType(damageType.id, { healing: event.target.checked })} /> Healing</label>
      </div>)}
    </div></section>
    <div className="phase8-feature-grid">
      <article><Shield size={20} /><strong>Team and Faction</strong><span>Friendly-fire and hostile-team filtering are resolved before damage.</span></article>
      <article><Crosshair size={20} /><strong>Hitbox and Hurtbox</strong><span>Active attack regions can use multipliers, hit limits, and damage types.</span></article>
      <article><HeartPulse size={20} /><strong>Health and Shield</strong><span>Shield absorbs damage first; healing and invulnerability remain explicit.</span></article>
      <article><FlaskConical size={20} /><strong>Status pipeline</strong><span>Damage can apply burning, poison, slow, stun, regeneration, and project-defined statuses.</span></article>
    </div>
  </div>;
}

function RecipeCard({ recipe }: { recipe: BehaviourRecipeDefinition }) {
  const apply = useEditorStore((state) => state.applyBehaviourRecipe);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  return <article className="phase8-recipe-card">
    <header><Bot size={18} /><div><strong>{recipe.name}</strong><span>{recipe.category}</span></div></header>
    <p>{recipe.description}</p>
    <div className="phase8-chip-row">{recipe.requiredComponents.map((component) => <code key={component}>{component}</code>)}</div>
    <details><summary>Guided steps</summary><ol>{recipe.tutorialSteps.map((step) => <li key={step}>{step}</li>)}</ol></details>
    <button type="button" disabled={!selectedObjectId} onClick={() => apply(recipe.id)}><Plus size={14} /> Apply to selected Game Object</button>
  </article>;
}

function AiPanel() {
  const project = useEditorStore((state) => state.project);
  const recipes = Array.isArray(project.behaviourRecipes) ? project.behaviourRecipes : [];
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Bot size={24} />} title="AI, Sensors, and Behaviour Recipes" description="AI uses sensors, a Blackboard, target selection, an inspectable state machine, and composable movement or combat behaviours." />
    <div className="phase8-ai-flow"><span>Sensors</span><i>→</i><span>Blackboard</span><i>→</i><span>Threat</span><i>→</i><span>State Machine</span><i>→</i><span>Navigation / Attack / Flee</span></div>
    <div className="phase8-card-grid recipes">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}{recipes.length === 0 && <div className="phase8-empty compact"><Bot size={24} /><strong>No behaviour recipes are available</strong><span>Reload the project to repair legacy recipe data.</span></div>}</div>
  </div>;
}

function AbilityCard({ ability }: { ability: AbilityDefinition }) {
  const update = useEditorStore((state) => state.updateAbility);
  return <article className="phase8-resource-card">
    <header><WandSparkles size={18} /><input value={ability.name} onChange={(event) => update(ability.id, { name: event.target.value })} /><code>{ability.id}</code></header>
    <textarea value={ability.description} onChange={(event) => update(ability.id, { description: event.target.value })} />
    <div className="phase8-field-grid">
      <label>Input<input value={ability.activationActionId} onChange={(event) => update(ability.id, { activationActionId: event.target.value })} /></label>
      <label>Cast time<NumericInput value={ability.castTimeSeconds} min={0} step={0.05} onChange={(value) => update(ability.id, { castTimeSeconds: value })} /></label>
      <label>Cooldown<NumericInput value={ability.cooldownSeconds} min={0} step={0.05} onChange={(value) => update(ability.id, { cooldownSeconds: value })} /></label>
      <label>Resource<input value={ability.resourceId} onChange={(event) => update(ability.id, { resourceId: event.target.value })} /></label>
      <label>Cost<NumericInput value={ability.resourceCost} min={0} onChange={(value) => update(ability.id, { resourceCost: value })} /></label>
      <label>Range<NumericInput value={ability.range} min={0} onChange={(value) => update(ability.id, { range: value })} /></label>
    </div>
    <footer>{ability.effects.length} effects · {ability.targetingMode}</footer>
  </article>;
}

function StatusCard({ status }: { status: StatusEffectDefinition }) {
  const update = useEditorStore((state) => state.updateStatusEffect);
  return <article className="phase8-resource-card status">
    <header><FlaskConical size={18} /><input value={status.name} onChange={(event) => update(status.id, { name: event.target.value })} /><code>{status.id}</code></header>
    <div className="phase8-field-grid">
      <label>Duration<NumericInput value={status.durationSeconds} min={0} step={0.1} onChange={(value) => update(status.id, { durationSeconds: value })} /></label>
      <label>Tick interval<NumericInput value={status.tickIntervalSeconds} min={0.01} step={0.05} onChange={(value) => update(status.id, { tickIntervalSeconds: value })} /></label>
      <label>Damage / tick<NumericInput value={status.damagePerTick} step={1} onChange={(value) => update(status.id, { damagePerTick: value })} /></label>
      <label>Max stacks<NumericInput value={status.maximumStacks} min={1} onChange={(value) => update(status.id, { maximumStacks: value })} /></label>
    </div>
  </article>;
}

function AbilitiesPanel() {
  const project = useEditorStore((state) => state.project);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<WandSparkles size={24} />} title="Abilities and Magic" description="Abilities combine resource costs, cast and cooldown phases, targeting, reusable effects, Status Effects, projectiles, and materials." />
    <h3>Ability assets</h3><div className="phase8-card-grid resources">{project.abilities.map((ability) => <AbilityCard key={ability.id} ability={ability} />)}</div>
    <h3>Status Effect assets</h3><div className="phase8-card-grid resources">{project.statusEffects.map((status) => <StatusCard key={status.id} status={status} />)}</div>
  </div>;
}

function StatsPanel() {
  const project = useEditorStore((state) => state.project);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Activity size={24} />} title="Statistics and Attributes" description="Game Objects can combine base values, formulas, regeneration, persistent current values, and temporary or permanent modifiers." />
    <div className="phase8-table">
      {project.stats.map((stat) => <div className="phase8-table-row stat" key={stat.id}><strong>{stat.name}</strong><code>{stat.id}</code><span>Base {stat.baseValue}</span><span>{stat.minimum}–{stat.maximum}</span><span>Regen {stat.regenerationPerSecond}/s</span><em>{stat.formula || "Direct value"}</em></div>)}
    </div>
    <div className="phase8-notice"><strong>Formula safety</strong><span>The runtime uses a typed arithmetic parser without JavaScript evaluation and reports missing values, malformed expressions, and circular project definitions.</span></div>
  </div>;
}

function LootCard({ table }: { table: LootTableDefinition }) {
  const update = useEditorStore((state) => state.updateLootTable);
  return <article className="phase8-resource-card loot"><header><Coins size={18} /><input value={table.name} onChange={(event) => update(table.id, { name: event.target.value })} /><code>{table.id}</code></header><p>{table.rolls} roll(s), {table.entries.length} weighted entries</p><ul>{table.entries.map((entry) => <li key={entry.id}><strong>{entry.referenceId}</strong><span>{entry.kind}</span><span>Weight {entry.weight}</span><span>{entry.minimumAmount}–{entry.maximumAmount}</span>{entry.guaranteed && <em>Guaranteed</em>}</li>)}</ul></article>;
}

function ProgressionPanel() {
  const project = useEditorStore((state) => state.project);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Coins size={24} />} title="Loot, Experience, and Progression" description="Weighted loot, nested tables, experience curves, levels, wallets, skills, and upgrade trees use reusable project assets and Components." />
    <h3>Loot tables</h3><div className="phase8-card-grid resources">{project.lootTables.map((table) => <LootCard key={table.id} table={table} />)}</div>
    <h3>Experience curves</h3><div className="phase8-card-grid compact">{project.experienceCurves.map((curve) => <article className="phase8-mini-card" key={curve.id}><strong>{curve.name}</strong><span>{curve.formula}</span><code>Base {curve.baseExperience} · Growth {curve.growthFactor} · Max {curve.maximumLevel}</code></article>)}</div>
    <h3>Upgrade trees</h3><div className="phase8-card-grid compact">{project.upgradeTrees.map((tree) => <article className="phase8-mini-card" key={tree.id}><strong>{tree.name}</strong><span>{tree.nodes.length} nodes</span><div className="phase8-chip-row">{tree.nodes.map((node) => <code key={node.id}>{node.name}</code>)}</div></article>)}</div>
  </div>;
}

function ScriptEditorCard({ script }: { script: ScriptDefinition }) {
  const updateScript = useEditorStore((state) => state.updateScript);
  const compiled = useMemo(() => compileLeonisScript(script), [script]);
  return <article className="phase8-script-card">
    <header><ScrollText size={18} /><input value={script.name} onChange={(event) => updateScript(script.id, { name: event.target.value })} /><label><input type="checkbox" checked={script.enabled} onChange={(event) => updateScript(script.id, { enabled: event.target.checked })} /> Enabled</label></header>
    <div className="phase8-script-toolbar"><button type="button" onClick={() => updateScript(script.id, { source: LEONIS_SCRIPT_SNIPPETS.starter })}>Starter</button><button type="button" onClick={() => updateScript(script.id, { source: LEONIS_SCRIPT_SNIPPETS.damageReaction })}>Damage reaction</button><span>{compiled.functions.size} functions</span><span className={compiled.errors.length ? "error" : "ok"}>{compiled.errors.length ? `${compiled.errors.length} diagnostics` : "Sandbox-valid"}</span></div>
    <textarea className="phase8-code-editor" spellCheck={false} value={script.source} onChange={(event) => updateScript(script.id, { source: event.target.value })} />
    {compiled.errors.length > 0 && <div className="phase8-code-diagnostics">{compiled.errors.map((diagnostic, index) => <div key={`${diagnostic.line}-${index}`}><strong>Line {diagnostic.line}</strong><span>{diagnostic.message}</span></div>)}</div>}
  </article>;
}

function ScriptsPanel() {
  const project = useEditorStore((state) => state.project);
  const addScript = useEditorStore((state) => state.addScript);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Braces size={24} />} title="Shadowium Script" description="A sandboxed, deterministic callback language for mechanics that do not justify a new Component. Scripts cannot access files, the network, or operating-system processes." action={<button type="button" className="material-button filled" onClick={addScript}><Plus size={14} /> New Script</button>} />
    <div className="phase8-notice"><strong>Approved runtime commands</strong><code>log · set_variable · emit · ai_set_state · damage · heal · cast_ability · add_currency · award_experience</code></div>
    {project.scripts.map((script) => <ScriptEditorCard key={script.id} script={script} />)}
  </div>;
}

function MaterialsPanel() {
  const project = useEditorStore((state) => state.project);
  const updateMaterial = useEditorStore((state) => state.updateMaterial);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Sparkles size={24} />} title="Materials, Shaders, and Effects" description="Materials are reusable Assets applied through a Material Stack or Post-Process Volume Component. Built-in effects remain editable and project-owned." />
    <div className="phase8-card-grid resources">{project.materials.map((material) => <article className="phase8-resource-card material" key={material.id}><header><Sparkles size={18} /><input value={material.name} onChange={(event) => updateMaterial(material.id, { name: event.target.value })} /><label><input type="checkbox" checked={material.enabled} onChange={(event) => updateMaterial(material.id, { enabled: event.target.checked })} /> Enabled</label></header><code>Shader: {material.shaderId}</code><pre>{JSON.stringify(material.uniforms, null, 2)}</pre></article>)}</div>
    <h3>Shader assets</h3><div className="phase8-card-grid compact">{project.shaders.map((shader) => <article className="phase8-mini-card" key={shader.id}><strong>{shader.name}</strong><span>{shader.target}</span><code>{shader.builtIn ? "Built-in editable preset" : "Project shader"}</code></article>)}</div>
  </div>;
}

function DebugPanel() {
  const project = useEditorStore((state) => state.project);
  return <div className="phase8-workspace-scroll">
    <SectionHeader icon={<Bug size={24} />} title="Runtime Debugging and Profiling" description="Open Game Preview and toggle Debug to inspect live Game Objects, Components, combat calculations, AI decisions, script errors, abilities, and frame timings." />
    <div className="phase8-feature-grid">
      <article><Bug size={20} /><strong>Runtime Inspector</strong><span>Transform, velocity, health, shield, resources, statuses, AI state, target, experience, level, and currencies.</span></article>
      <article><Bot size={20} /><strong>AI trace</strong><span>Current and previous states, reason, sensors, Blackboard values, target, and distance.</span></article>
      <article><Swords size={20} /><strong>Combat log</strong><span>Base damage, critical result, resistance multiplier, shield absorption, final damage, and status application.</span></article>
      <article><Activity size={20} /><strong>Profiler</strong><span>Frame time, simulation, AI, combat, scripts, physics, rendering, active Game Objects, Components, and draw calls.</span></article>
    </div>
    <pre className="phase8-config-preview">{JSON.stringify(project.settings.runtimeDebug, null, 2)}</pre>
  </div>;
}

export function GameplayWorkbench() {
  const [tab, setTab] = useState<GameplayTab>("components");
  return <section className="phase8-gameplay-workbench">
    <aside className="phase8-workbench-tabs">{TAB_DEFINITIONS.map((definition) => { const Icon = definition.icon; return <button key={definition.id} type="button" className={tab === definition.id ? "active" : ""} onClick={() => setTab(definition.id)}><Icon size={17} /><span>{definition.label}</span></button>; })}</aside>
    <main className="phase8-workbench-main">
      {tab === "components" && <ComponentsPanel />}
      {tab === "combat" && <CombatPanel />}
      {tab === "ai" && <AiPanel />}
      {tab === "abilities" && <AbilitiesPanel />}
      {tab === "stats" && <StatsPanel />}
      {tab === "progression" && <ProgressionPanel />}
      {tab === "scripts" && <ScriptsPanel />}
      {tab === "materials" && <MaterialsPanel />}
      {tab === "debug" && <DebugPanel />}
    </main>
  </section>;
}
