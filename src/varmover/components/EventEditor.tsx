import { Plus, Trash2, Zap } from "lucide-react";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type {
  EventActionDefinition,
  EventConditionDefinition,
  EventRuleDocument,
  JsonPrimitive,
} from "../editor/types";
import { CommitNumberField, CommitTextField, Switch } from "./EditorControls";

function PrimitiveField({
  value,
  onChange,
}: {
  value: JsonPrimitive;
  onChange: (value: JsonPrimitive) => void;
}) {
  const type = typeof value;
  if (type === "boolean") {
    return <Switch checked={Boolean(value)} onChange={onChange} />;
  }
  if (type === "number") {
    return <CommitNumberField value={Number(value)} onCommit={onChange} />;
  }
  return <CommitTextField value={String(value ?? "")} onCommit={onChange} />;
}

function ObjectSelect({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const project = useEditorStore((state) => state.project);
  return (
    <select className="rule-select" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">Any / none</option>
      {project.scenes.map((scene) => (
        <optgroup key={scene.id} label={scene.name}>
          {scene.objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function ConditionRow({ rule, condition }: { rule: EventRuleDocument; condition: EventConditionDefinition }) {
  const updateCondition = useEditorStore((state) => state.updateCondition);
  const removeCondition = useEditorStore((state) => state.removeCondition);

  return (
    <div className="rule-row condition-row">
      <span className="rule-prefix if-prefix">IF</span>
      <select
        className="rule-select"
        value={condition.type}
        onChange={(event) => updateCondition(rule.id, condition.id, { type: event.target.value as EventConditionDefinition["type"] })}
      >
        <option value="always">Always</option>
        <option value="variable-equals">Variable equals</option>
        <option value="variable-compare">Compare variable</option>
        <option value="object-enabled">Object enabled</option>
        <option value="object-has-component">Object has Component</option>
        <option value="object-has-tag">Object has tag</option>
        <option value="inventory-contains">Inventory contains item</option>
        <option value="scene-is-active">Scene is active</option>
        <option value="random-chance">Random chance</option>
      </select>

      {(condition.type === "variable-equals" || condition.type === "variable-compare") && (
        <>
          <CommitTextField value={condition.key} placeholder="variable name" onCommit={(key) => updateCondition(rule.id, condition.id, { key })} />
          {condition.type === "variable-compare" && (
            <select className="rule-select compact-operator" value={condition.operator} onChange={(event) => updateCondition(rule.id, condition.id, { operator: event.target.value as EventConditionDefinition["operator"] })}>
              <option value="==">=</option>
              <option value="!=">≠</option>
              <option value=">">&gt;</option>
              <option value=">=">≥</option>
              <option value="<">&lt;</option>
              <option value="<=">≤</option>
            </select>
          )}
          <PrimitiveField value={condition.value} onChange={(value) => updateCondition(rule.id, condition.id, { value })} />
        </>
      )}
      {condition.type === "object-enabled" && (
        <>
          <ObjectSelect value={condition.objectId} onChange={(objectId) => updateCondition(rule.id, condition.id, { objectId })} />
          <Switch checked={Boolean(condition.value)} onChange={(value) => updateCondition(rule.id, condition.id, { value })} />
        </>
      )}
      {(condition.type === "object-has-component" || condition.type === "object-has-element") && (
        <>
          <ObjectSelect value={condition.objectId} onChange={(objectId) => updateCondition(rule.id, condition.id, { objectId })} />
          <select className="rule-select" value={condition.componentType ?? ""} onChange={(event) => updateCondition(rule.id, condition.id, { componentType: (event.target.value || null) as EventConditionDefinition["componentType"] })}>
            <option value="">Choose element</option>
            <option value="sprite-renderer">Sprite Renderer</option>
            <option value="player-input">Player Input</option>
            <option value="top-down-movement">Top-Down Movement</option>
            <option value="directional-animation">Directional Animation</option>
            <option value="box-collider">Box Collider</option>
            <option value="health">Health</option>
            <option value="camera-target">Camera Target</option>
            <option value="interaction">Interaction</option>
          </select>
        </>
      )}
      {condition.type === "object-has-tag" && (
        <>
          <ObjectSelect value={condition.objectId} onChange={(objectId) => updateCondition(rule.id, condition.id, { objectId })} />
          <CommitTextField value={condition.key} placeholder="tag" onCommit={(key) => updateCondition(rule.id, condition.id, { key })} />
        </>
      )}
      {condition.type === "inventory-contains" && (
        <><CommitTextField value={condition.key} placeholder="item id" onCommit={(key) => updateCondition(rule.id, condition.id, { key })} /><CommitNumberField value={Number(condition.value ?? 1)} minimum={1} onCommit={(value) => updateCondition(rule.id, condition.id, { value })} /></>
      )}
      {condition.type === "scene-is-active" && (
        <select className="rule-select" value={String(condition.value ?? "")} onChange={(event) => updateCondition(rule.id, condition.id, { value: event.target.value })}><option value="">Choose scene</option>{useEditorStore.getState().project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>
      )}
      {condition.type === "random-chance" && (
        <label className="mini-number-field"><span>%</span><CommitNumberField value={Number(condition.value ?? 50)} minimum={0} maximum={100} onCommit={(value) => updateCondition(rule.id, condition.id, { value })} /></label>
      )}
      {condition.type === "always" && <span className="rule-explanation">The actions always run when the trigger fires.</span>}
      <button className="icon-button compact danger" type="button" onClick={() => removeCondition(rule.id, condition.id)}><Trash2 size={14} /></button>
    </div>
  );
}

function ActionRow({ rule, action }: { rule: EventRuleDocument; action: EventActionDefinition }) {
  const project = useEditorStore((state) => state.project);
  const updateAction = useEditorStore((state) => state.updateAction);
  const removeAction = useEditorStore((state) => state.removeAction);

  return (
    <div className="rule-row action-row">
      <span className="rule-prefix do-prefix">DO</span>
      <select className="rule-select" value={action.type} onChange={(event) => updateAction(rule.id, action.id, { type: event.target.value as EventActionDefinition["type"] })}>
        <option value="set-object-enabled">Activate / deactivate object</option>
        <option value="set-runtime-visible">Show / hide renderer</option>
        <option value="set-collision-enabled">Enable / disable collision</option>
        <option value="set-logic-enabled">Enable / disable logic</option>
        <option value="set-element-property">Set element property</option>
        <option value="set-health">Set health</option>
        <option value="change-health">Change health</option>
        <option value="destroy-object">Destroy object</option>
        <option value="move-object">Move object by</option>
        <option value="set-object-position">Set object position</option>
        <option value="set-variable">Set variable</option>
        <option value="play-animation">Play animation</option>
        <option value="stop-animation">Stop animation</option>
        <option value="change-scene">Change scene</option>
        <option value="wait">Wait</option>
        <option value="play-sound">Play sound</option>
        <option value="stop-sound">Stop sound</option>
        <option value="set-camera-zoom">Set camera zoom</option>
        <option value="set-camera-fov">Set camera field of view</option>
        <option value="shake-camera">Shake camera</option>
        <option value="show-ui">Show UI object</option>
        <option value="hide-ui">Hide UI object</option>
        <option value="set-text">Set UI text</option>
        <option value="give-item">Give item</option>
        <option value="remove-item">Remove item</option>
        <option value="save-game">Save game</option>
        <option value="load-game">Load game</option>
        <option value="debug-message">Write debug message</option>
      </select>

      {(["set-object-enabled", "set-runtime-visible", "set-collision-enabled", "set-logic-enabled"] as const).includes(action.type as "set-object-enabled") && (
        <><ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} /><Switch checked={Boolean(action.value)} onChange={(value) => updateAction(rule.id, action.id, { value })} /></>
      )}
      {action.type === "set-element-property" && (
        <>
          <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />
          <select className="rule-select" value={action.componentType ?? ""} onChange={(event) => updateAction(rule.id, action.id, { componentType: (event.target.value || null) as EventActionDefinition["componentType"] })}>
            <option value="">Choose element</option>
            <option value="sprite-renderer">Sprite Renderer</option>
            <option value="player-input">Player Input</option>
            <option value="top-down-movement">Top-Down Movement</option>
            <option value="directional-animation">Directional Animation</option>
            <option value="box-collider">Box Collider</option>
            <option value="health">Health</option>
            <option value="camera-target">Camera Target</option>
            <option value="interaction">Interaction</option>
            <option value="patrol">Patrol</option>
            <option value="follow-target">Follow Target</option>
          </select>
          <CommitTextField value={action.propertyKey} placeholder="property key" onCommit={(propertyKey) => updateAction(rule.id, action.id, { propertyKey })} />
          <PrimitiveField value={action.value} onChange={(value) => updateAction(rule.id, action.id, { value })} />
        </>
      )}
      {(action.type === "set-health" || action.type === "change-health") && (
        <>
          <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />
          <CommitNumberField value={Number(action.value ?? 0)} onCommit={(value) => updateAction(rule.id, action.id, { value })} />
        </>
      )}
      {action.type === "destroy-object" && <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />}
      {(action.type === "move-object" || action.type === "set-object-position") && (
        <>
          <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />
          <label className="mini-number-field"><span>X</span><CommitNumberField value={action.x} onCommit={(x) => updateAction(rule.id, action.id, { x })} /></label>
          <label className="mini-number-field"><span>Y</span><CommitNumberField value={action.y} onCommit={(y) => updateAction(rule.id, action.id, { y })} /></label>
        </>
      )}
      {action.type === "set-variable" && (
        <><CommitTextField value={action.key} placeholder="variable name" onCommit={(key) => updateAction(rule.id, action.id, { key })} /><PrimitiveField value={action.value} onChange={(value) => updateAction(rule.id, action.id, { value })} /></>
      )}
      {action.type === "play-animation" && (
        <><ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} /><select className="rule-select" value={action.clipId ?? ""} onChange={(event) => updateAction(rule.id, action.id, { clipId: event.target.value || null })}><option value="">Choose clip</option>{project.animations.map((clip) => <option key={clip.id} value={clip.id}>{clip.name}</option>)}</select></>
      )}
      {action.type === "stop-animation" && <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />}
      {action.type === "change-scene" && (
        <select className="rule-select" value={action.sceneId ?? ""} onChange={(event) => updateAction(rule.id, action.id, { sceneId: event.target.value || null })}><option value="">Choose scene</option>{project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>
      )}
      {action.type === "wait" && <label className="mini-number-field"><span>ms</span><CommitNumberField value={Number(action.durationMs ?? 250)} minimum={0} onCommit={(durationMs) => updateAction(rule.id, action.id, { durationMs })} /></label>}
      {(action.type === "play-sound" || action.type === "stop-sound" || action.type === "show-ui" || action.type === "hide-ui") && <ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} />}
      {action.type === "set-camera-zoom" && <CommitNumberField value={Number(action.value ?? 1)} minimum={0.1} maximum={8} onCommit={(value) => updateAction(rule.id, action.id, { value })} />}
      {action.type === "set-camera-fov" && <label className="mini-number-field"><span>°</span><CommitNumberField value={Number(action.value ?? 60)} minimum={20} maximum={160} onCommit={(value) => updateAction(rule.id, action.id, { value })} /></label>}
      {action.type === "shake-camera" && <><CommitNumberField value={Number(action.value ?? 8)} minimum={0} maximum={200} onCommit={(value) => updateAction(rule.id, action.id, { value })} /><CommitNumberField value={Number(action.durationMs ?? 250)} minimum={0} onCommit={(durationMs) => updateAction(rule.id, action.id, { durationMs })} /></>}
      {action.type === "set-text" && <><ObjectSelect value={action.objectId} onChange={(objectId) => updateAction(rule.id, action.id, { objectId })} /><CommitTextField value={String(action.value ?? "")} placeholder="New text" onCommit={(value) => updateAction(rule.id, action.id, { value })} /></>}
      {(action.type === "give-item" || action.type === "remove-item") && <><CommitTextField value={action.key} placeholder="item id" onCommit={(key) => updateAction(rule.id, action.id, { key })} /><CommitNumberField value={Number(action.value ?? 1)} minimum={1} onCommit={(value) => updateAction(rule.id, action.id, { value })} /></>}
      {(action.type === "save-game" || action.type === "load-game") && <span className="rule-explanation">Uses the project runtime save.</span>}
      {action.type === "debug-message" && <CommitTextField value={action.message} placeholder="Message" onCommit={(message) => updateAction(rule.id, action.id, { message })} />}
      <button className="icon-button compact danger" type="button" onClick={() => removeAction(rule.id, action.id)}><Trash2 size={14} /></button>
    </div>
  );
}

function RuleEditor({ rule }: { rule: EventRuleDocument }) {
  const updateRule = useEditorStore((state) => state.updateRule);
  const addCondition = useEditorStore((state) => state.addCondition);
  const addAction = useEditorStore((state) => state.addAction);
  const deleteRule = useEditorStore((state) => state.deleteRule);

  return (
    <div className="rule-editor">
      <header className="rule-editor-header">
        <div className="rule-name-field"><Zap size={18} /><CommitTextField value={rule.name} onCommit={(name) => updateRule(rule.id, { name })} /></div>
        <Switch checked={rule.enabled} onChange={(enabled) => updateRule(rule.id, { enabled })} label="Enabled" />
        <button className="material-button text danger-text" type="button" onClick={() => deleteRule(rule.id)}><Trash2 size={15} /> Delete Rule</button>
      </header>

      <div className="rule-block trigger-block">
        <div className="rule-row trigger-row">
          <span className="rule-prefix when-prefix">WHEN</span>
          <select className="rule-select" value={rule.trigger.type} onChange={(event) => updateRule(rule.id, { trigger: { ...rule.trigger, type: event.target.value as EventRuleDocument["trigger"]["type"] } })}>
            <option value="preview-start">Preview starts</option>
            <option value="object-created">Object created</option>
            <option value="object-enabled">Object enabled</option>
            <option value="object-disabled">Object disabled</option>
            <option value="trigger-enter">Trigger entered</option>
            <option value="trigger-exit">Trigger exited</option>
            <option value="interaction">Interaction pressed</option>
            <option value="health-zero">Health reaches zero</option>
            <option value="scene-started">Scene started</option>
            <option value="scene-ended">Scene ended</option>
            <option value="item-collected">Item collected</option>
            <option value="button-clicked">UI button clicked</option>
            <option value="timer-completed">Timer completed</option>
            <option value="variable-changed">Variable changed</option>
            <option value="animation-finished">Animation finished</option>
            <option value="audio-finished">Audio finished</option>
          </select>
          {rule.trigger.type !== "preview-start" && rule.trigger.type !== "scene-started" && rule.trigger.type !== "scene-ended" && rule.trigger.type !== "variable-changed" && (
            <ObjectSelect value={rule.trigger.sourceObjectId} onChange={(sourceObjectId) => updateRule(rule.id, { trigger: { ...rule.trigger, sourceObjectId } })} />
          )}
          {(rule.trigger.type === "trigger-enter" || rule.trigger.type === "trigger-exit" || rule.trigger.type === "interaction") && (
            <ObjectSelect value={rule.trigger.targetObjectId} onChange={(targetObjectId) => updateRule(rule.id, { trigger: { ...rule.trigger, targetObjectId } })} />
          )}
        </div>
      </div>

      <div className="rule-section-title"><span>Conditions</span><button className="material-button text" type="button" onClick={() => addCondition(rule.id)}><Plus size={14} /> Add Condition</button></div>
      <div className="rule-block condition-block">
        {rule.conditions.length > 0 ? rule.conditions.map((condition) => <ConditionRow key={condition.id} rule={rule} condition={condition} />) : <div className="rule-empty-row">No conditions. The actions always run when the trigger fires.</div>}
      </div>

      <div className="rule-section-title"><span>Actions</span><button className="material-button text" type="button" onClick={() => addAction(rule.id)}><Plus size={14} /> Add Action</button></div>
      <div className="rule-block action-block">
        {rule.actions.length > 0 ? rule.actions.map((action) => <ActionRow key={action.id} rule={rule} action={action} />) : <div className="rule-empty-row">This rule does nothing yet.</div>}
      </div>
    </div>
  );
}

export function EventEditor() {
  const project = useEditorStore((state) => state.project);
  const selectedRuleId = useEditorStore((state) => state.selectedRuleId);
  const selectRule = useEditorStore((state) => state.selectRule);
  const addRule = useEditorStore((state) => state.addRule);
  const selected = project.eventRules.find((rule) => rule.id === selectedRuleId) ?? project.eventRules[0];
  const scene = getActiveScene(project);

  return (
    <div className="event-workspace">
      <aside className="rule-list">
        <header><span>Event Rules</span><button className="icon-button compact" type="button" onClick={addRule}><Plus size={14} /></button></header>
        {project.eventRules.map((rule) => (
          <button key={rule.id} className={selected?.id === rule.id ? "active" : ""} type="button" onClick={() => selectRule(rule.id)}>
            <Zap size={14} /><span>{rule.name}</span><small>{rule.enabled ? "On" : "Off"}</small>
          </button>
        ))}
        {project.eventRules.length === 0 && <div className="mini-empty"><Zap size={25} /><span>Create a rule to connect triggers and actions.</span></div>}
      </aside>
      <section className="rule-editor-main">
        {selected ? <RuleEditor rule={selected} /> : <div className="bottom-empty-state"><Zap size={34} /><div><strong>No event rule selected</strong><span>Create a rule for {scene.name}.</span></div><button className="material-button tonal" type="button" onClick={addRule}><Plus size={15} /> New Rule</button></div>}
      </section>
    </div>
  );
}
