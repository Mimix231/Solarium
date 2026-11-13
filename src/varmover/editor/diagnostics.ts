import { getComponentDefinition, COMPONENT_CATALOG } from "./catalog";
import { compileLeonisScript } from "./leonisScript";
import { evaluateFormula } from "./runtimeSystems";
import type {
  DiagnosticEntry,
  ComponentType,
  ProjectDocument,
} from "./types";

export function buildDiagnostics(project: ProjectDocument): DiagnosticEntry[] {
  const diagnostics: DiagnosticEntry[] = [];
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const audioAssetIds = new Set(project.assets.filter((asset) => asset.kind === "audio" || asset.mimeType.startsWith("audio/")).map((asset) => asset.id));
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const animationIds = new Set(project.animations.map((clip) => clip.id));
  const animationSetIds = new Set(project.animationSets.map((set) => set.id));
  const inputActionIds = new Set(project.settings.inputActions.map((action) => action.id));
  const collisionLayers = new Set(project.settings.collisionLayers);
  const tileIds = new Set(project.tilePalette.map((tile) => tile.id));
  const damageTypeIds = new Set(project.damageTypes.map((entry) => entry.id));
  const statIds = new Set(project.stats.map((entry) => entry.id));
  const abilityIds = new Set(project.abilities.map((entry) => entry.id));
  const statusEffectIds = new Set(project.statusEffects.map((entry) => entry.id));
  const lootTableIds = new Set(project.lootTables.map((entry) => entry.id));
  const experienceCurveIds = new Set(project.experienceCurves.map((entry) => entry.id));
  const upgradeTreeIds = new Set(project.upgradeTrees.map((entry) => entry.id));
  const shaderIds = new Set(project.shaders.map((entry) => entry.id));
  const materialIds = new Set(project.materials.map((entry) => entry.id));
  const scriptIds = new Set(project.scripts.map((entry) => entry.id));
  const prefabIds = new Set(project.prefabs.map((entry) => entry.id));
  const objectIds = new Set<string>();
  const componentIds = new Set<string>();
  const sceneIdList = project.scenes.map((scene) => scene.id);
  if (new Set(sceneIdList).size !== sceneIdList.length) {
    diagnostics.push({ id: "project:duplicate-scene-id", severity: "error", message: "Two or more scenes share the same internal ID.", sceneId: null, objectId: null, componentId: null });
  }
  for (const tile of project.tilePalette) {
    if (tile.assetId && !assetIds.has(tile.assetId)) {
      diagnostics.push({ id: `tile:${tile.id}:missing-asset`, severity: "error", message: `Tile “${tile.name}” references an asset that no longer exists.`, sceneId: null, objectId: null, componentId: null });
    }
  }
  if (!sceneIds.has(project.settings.initialSceneId)) {
    diagnostics.push({ id: "project:missing-initial-scene", severity: "error", message: "The project initial scene no longer exists.", sceneId: null, objectId: null, componentId: null });
  }

  for (const clip of project.animations) {
    if (!clip.frames.length) {
      diagnostics.push({ id: `animation:${clip.id}:empty`, severity: "warning", message: `Animation Clip “${clip.name}” contains no frames.`, sceneId: null, objectId: null, componentId: null });
      continue;
    }
    for (let frameIndex = 0; frameIndex < clip.frames.length; frameIndex += 1) {
      const reference = clip.frames[frameIndex];
      const assetId = clip.assetId;
      const asset = project.assets.find((entry) => entry.id === assetId);
      if (!asset) {
        diagnostics.push({ id: `animation:${clip.id}:frame:${frameIndex}:missing-asset`, severity: "error", message: `Animation Clip “${clip.name}” frame ${frameIndex + 1} references a missing sprite asset.`, sceneId: null, objectId: null, componentId: null });
        continue;
      }
      if (!asset.frames.some((frame) => frame.id === reference.frameId)) diagnostics.push({ id: `animation:${clip.id}:frame:${frameIndex}:missing-frame`, severity: "error", message: `Animation Clip “${clip.name}” frame ${frameIndex + 1} references a sprite frame that no longer exists.`, sceneId: null, objectId: null, componentId: null });
    }
    for (const event of clip.events ?? []) {
      if (event.frameIndex < 0 || event.frameIndex >= clip.frames.length) diagnostics.push({ id: `animation:${clip.id}:event:${event.id}:frame`, severity: "error", message: `Animation event “${event.name}” in “${clip.name}” points outside the clip timeline.`, sceneId: null, objectId: null, componentId: null });
      if (event.type === "play-sound" && event.targetId && !audioAssetIds.has(event.targetId)) diagnostics.push({ id: `animation:${clip.id}:event:${event.id}:audio`, severity: "error", message: `Animation event “${event.name}” references missing audio asset “${event.targetId}”.`, sceneId: null, objectId: null, componentId: null });
      if (event.type === "spawn-prefab" && event.targetId && !prefabIds.has(event.targetId)) diagnostics.push({ id: `animation:${clip.id}:event:${event.id}:prefab`, severity: "error", message: `Animation event “${event.name}” references missing Prefab “${event.targetId}”.`, sceneId: null, objectId: null, componentId: null });
    }
  }
  for (const set of project.animationSets) {
    const mappings = [
      ...Object.values(set.directions ?? {}),
      ...Object.values(set.states ?? {}).flatMap((directions) => Object.values(directions ?? {})),
    ].filter(Boolean);
    for (const clipId of mappings) if (!animationIds.has(clipId)) diagnostics.push({ id: `animation-set:${set.id}:missing-clip:${clipId}`, severity: "error", message: `Animation Set “${set.name}” references missing Animation Clip “${clipId}”.`, sceneId: null, objectId: null, componentId: null });
  }

  for (const ability of project.abilities) {
    if (ability.iconAssetId && !assetIds.has(ability.iconAssetId)) diagnostics.push({ id: `ability:${ability.id}:missing-icon`, severity: "error", message: `Ability “${ability.name}” references a missing icon asset.`, sceneId: null, objectId: null, componentId: null });
    if (ability.activationActionId && !inputActionIds.has(ability.activationActionId)) diagnostics.push({ id: `ability:${ability.id}:missing-input`, severity: "warning", message: `Ability “${ability.name}” uses missing input action “${ability.activationActionId}”.`, sceneId: null, objectId: null, componentId: null });
    for (const effect of ability.effects) {
      if (effect.damageTypeId && !damageTypeIds.has(effect.damageTypeId)) diagnostics.push({ id: `ability:${ability.id}:${effect.id}:missing-damage-type`, severity: "error", message: `Ability “${ability.name}” references missing damage type “${effect.damageTypeId}”.`, sceneId: null, objectId: null, componentId: null });
      if (effect.statusEffectId && !statusEffectIds.has(effect.statusEffectId)) diagnostics.push({ id: `ability:${ability.id}:${effect.id}:missing-status`, severity: "error", message: `Ability “${ability.name}” references missing Status Effect “${effect.statusEffectId}”.`, sceneId: null, objectId: null, componentId: null });
      if (effect.prefabId && !prefabIds.has(effect.prefabId)) diagnostics.push({ id: `ability:${ability.id}:${effect.id}:missing-prefab`, severity: "error", message: `Ability “${ability.name}” references missing Prefab “${effect.prefabId}”.`, sceneId: null, objectId: null, componentId: null });
      if (effect.statId && !statIds.has(effect.statId)) diagnostics.push({ id: `ability:${ability.id}:${effect.id}:missing-stat`, severity: "error", message: `Ability “${ability.name}” references missing Stat “${effect.statId}”.`, sceneId: null, objectId: null, componentId: null });
    }
  }
  for (const status of project.statusEffects) {
    if (status.damageTypeId && !damageTypeIds.has(status.damageTypeId)) diagnostics.push({ id: `status:${status.id}:missing-damage-type`, severity: "error", message: `Status Effect “${status.name}” references missing damage type “${status.damageTypeId}”.`, sceneId: null, objectId: null, componentId: null });
    if (status.materialId && !materialIds.has(status.materialId)) diagnostics.push({ id: `status:${status.id}:missing-material`, severity: "error", message: `Status Effect “${status.name}” references missing Material “${status.materialId}”.`, sceneId: null, objectId: null, componentId: null });
  }
  for (const table of project.lootTables) for (const entry of table.entries) {
    if (entry.kind === "loot-table" && !lootTableIds.has(entry.referenceId)) diagnostics.push({ id: `loot:${table.id}:${entry.id}:missing-table`, severity: "error", message: `Loot Table “${table.name}” references missing nested table “${entry.referenceId}”.`, sceneId: null, objectId: null, componentId: null });
    if (entry.kind === "prefab" && !prefabIds.has(entry.referenceId)) diagnostics.push({ id: `loot:${table.id}:${entry.id}:missing-prefab`, severity: "error", message: `Loot Table “${table.name}” references missing Prefab “${entry.referenceId}”.`, sceneId: null, objectId: null, componentId: null });
  }
  for (const material of project.materials) if (!shaderIds.has(material.shaderId)) diagnostics.push({ id: `material:${material.id}:missing-shader`, severity: "error", message: `Material “${material.name}” references a missing Shader.`, sceneId: null, objectId: null, componentId: null });
  for (const script of project.scripts) for (const issue of compileLeonisScript(script).errors) diagnostics.push({ id: `script:${script.id}:${issue.line}:${issue.message}`, severity: "error", message: `Shadowium Script “${script.name}”, line ${issue.line}: ${issue.message}`, sceneId: null, objectId: null, componentId: null });
  for (const stat of project.stats) if (stat.formula && !Number.isFinite(evaluateFormula(stat.formula, Object.fromEntries(project.stats.map((entry) => [entry.id, entry.baseValue]))))) diagnostics.push({ id: `stat:${stat.id}:invalid-formula`, severity: "error", message: `Stat “${stat.name}” contains an invalid formula.`, sceneId: null, objectId: null, componentId: null });
  for (const tree of project.upgradeTrees) for (const node of tree.nodes) {
    for (const prerequisite of node.prerequisites) if (!tree.nodes.some((candidate) => candidate.id === prerequisite)) diagnostics.push({ id: `upgrade:${tree.id}:${node.id}:missing-prerequisite:${prerequisite}`, severity: "error", message: `Upgrade “${node.name}” references missing prerequisite “${prerequisite}”.`, sceneId: null, objectId: null, componentId: null });
    if (node.unlockAbilityId && !abilityIds.has(node.unlockAbilityId)) diagnostics.push({ id: `upgrade:${tree.id}:${node.id}:missing-ability`, severity: "error", message: `Upgrade “${node.name}” unlocks a missing Ability.`, sceneId: null, objectId: null, componentId: null });
  }

  const ruleTargets = new Set(
    project.eventRules.flatMap((rule) =>
      [rule.trigger.sourceObjectId, rule.trigger.targetObjectId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  for (const scene of project.scenes) {
    const layerIds = new Set(scene.layers.map((layer) => layer.id));
    if (layerIds.size !== scene.layers.length) {
      diagnostics.push({ id: `${scene.id}:duplicate-layer-id`, severity: "error", message: `${scene.name} contains duplicate scene-layer IDs.`, sceneId: scene.id, objectId: null, componentId: null });
    }
    const spawnIds = new Set<string>();
    const saveKeys = new Set<string>();
    const menuScreenIds = new Set<string>();
    for (const screenObject of scene.objects) {
      const screenElement = screenObject.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
      if (!screenElement) continue;
      const screenId = String(screenElement.settings.screenId ?? screenObject.name).trim();
      if (!screenId) {
        diagnostics.push({ id: `${screenObject.id}:${screenElement.id}:empty-screen-id`, severity: "error", message: `${screenObject.name} needs a non-empty UI screen ID.`, sceneId: scene.id, objectId: screenObject.id, componentId: screenElement.id });
      } else if (menuScreenIds.has(screenId)) {
        diagnostics.push({ id: `${scene.id}:duplicate-ui-screen:${screenId}`, severity: "error", message: `${scene.name} contains more than one UI screen named “${screenId}”.`, sceneId: scene.id, objectId: screenObject.id, componentId: screenElement.id });
      }
      menuScreenIds.add(screenId);
    }
    const cameras = scene.objects.flatMap((object) => object.components.filter((element) => element.type === "camera" && element.enabled).map((element) => ({ object, element })));
    const primaryCameras = cameras.filter(({ element }) => element.settings.primary === true);
    if (cameras.length === 0) diagnostics.push({
      id: `${scene.id}:no-camera`,
      severity: scene.objects.length === 0 ? "info" : "warning",
      message: scene.objects.length === 0
        ? `${scene.name} is empty. Game Preview will use a temporary camera until you add one.`
        : `${scene.name} has no Camera Component; Game Preview will use a temporary default camera.`,
      sceneId: scene.id,
      objectId: null,
      componentId: null,
    });
    if (primaryCameras.length > 1) diagnostics.push({ id: `${scene.id}:multiple-primary-cameras`, severity: "warning", message: `${scene.name} has more than one primary Camera Component. The first valid camera will be used.`, sceneId: scene.id, objectId: primaryCameras[1].object.id, componentId: primaryCameras[1].element.id });
    for (const object of scene.objects) {
      const spawn = object.components.find((element) => element.type === "scene-spawn-point" && element.enabled);
      if (!spawn) continue;
      const spawnId = String(spawn.settings.spawnId ?? "default").trim() || "default";
      if (spawnIds.has(spawnId)) diagnostics.push({ id: `${scene.id}:duplicate-spawn:${spawnId}`, severity: "error", message: `${scene.name} contains more than one spawn point named “${spawnId}”.`, sceneId: scene.id, objectId: object.id, componentId: spawn.id });
      spawnIds.add(spawnId);
    }
    for (const object of scene.objects) {
      if (objectIds.has(object.id)) diagnostics.push({ id: `${scene.id}:${object.id}:duplicate-object-id`, severity: "error", message: `${object.name} shares an internal ID with another object.`, sceneId: scene.id, objectId: object.id, componentId: null });
      objectIds.add(object.id);
      if (object.parentId && !scene.objects.some((candidate) => candidate.id === object.parentId)) diagnostics.push({ id: `${object.id}:missing-parent`, severity: "error", message: `${object.name} references a parent object that no longer exists in this scene.`, sceneId: scene.id, objectId: object.id, componentId: null });
      const saveState = object.components.find((element) => element.type === "save-state" && element.enabled);
      if (saveState) {
        const saveKey = String(saveState.settings.saveKey ?? "").trim() || `${scene.id}/${object.id}`;
        if (saveKeys.has(saveKey)) diagnostics.push({ id: `${scene.id}:duplicate-save-key:${saveKey}`, severity: "error", message: `${scene.name} contains more than one persistent object using save key “${saveKey}”.`, sceneId: scene.id, objectId: object.id, componentId: saveState.id });
        saveKeys.add(saveKey);
      }
      if (!layerIds.has(object.layerId)) {
        diagnostics.push({ id: `${object.id}:missing-scene-layer`, severity: "error", message: `${object.name} references a scene layer that no longer exists.`, sceneId: scene.id, objectId: object.id, componentId: null });
      }
      for (const element of object.components) {
        if (componentIds.has(element.id)) diagnostics.push({ id: `${object.id}:${element.id}:duplicate-component-id`, severity: "error", message: `${object.name} contains a Component ID already used elsewhere in the project.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        componentIds.add(element.id);
        let definition;
        try {
          definition = getComponentDefinition(element.type);
        } catch {
          diagnostics.push({ id: `${object.id}:${element.id}:unknown-component`, severity: "error", message: `${object.name} contains unsupported Component type “${element.type}”. Remove it or replace it with a current Component.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          continue;
        }
        const sameTypeCount = object.components.filter((candidate) => candidate.type === element.type).length;
        if (definition.allowMultiple !== true && sameTypeCount > 1 && object.components.find((candidate) => candidate.type === element.type)?.id === element.id) diagnostics.push({ id: `${object.id}:${element.type}:multiple-components`, severity: "error", message: `${object.name} contains multiple ${definition.name} Components, but this Component only allows one instance.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        for (const incompatible of definition.incompatibleWith ?? []) if (object.components.some((candidate) => candidate.enabled && candidate.type === incompatible)) diagnostics.push({ id: `${object.id}:${element.id}:incompatible:${incompatible}`, severity: "error", message: `${definition.name} is incompatible with ${getComponentDefinition(incompatible).name} on ${object.name}.`, sceneId: scene.id, objectId: object.id, componentId: element.id });

        for (const dependency of definition.dependencies) {
          if (!object.components.some((candidate) => candidate.type === dependency)) {
            diagnostics.push({
              id: `${object.id}:${element.id}:dependency:${dependency}`,
              severity: "error",
              message: `${definition.name} requires ${getComponentDefinition(dependency).name}.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          }
        }

        if (element.type === "sprite-renderer") {
          const assetId = String(element.settings.assetId ?? "");
          if (assetId && !assetIds.has(assetId)) {
            diagnostics.push({
              id: `${object.id}:${element.id}:missing-asset`,
              severity: "error",
              message: `${object.name} references an image asset that no longer exists.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          } else if (!assetId) {
            diagnostics.push({
              id: `${object.id}:${element.id}:no-asset`,
              severity: "info",
              message: `${object.name} uses its editor placeholder because no sprite asset is assigned.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          }
        }

        if (element.type === "directional-animation") {
          const clipKeys = [
            "idleDownClipId",
            "idleUpClipId",
            "idleLeftClipId",
            "idleRightClipId",
            "idleUpLeftClipId",
            "idleUpRightClipId",
            "idleDownLeftClipId",
            "idleDownRightClipId",
            "walkDownClipId",
            "walkUpClipId",
            "walkLeftClipId",
            "walkRightClipId",
            "walkUpLeftClipId",
            "walkUpRightClipId",
            "walkDownLeftClipId",
            "walkDownRightClipId",
          ];

          const assigned = clipKeys.filter((key) => {
            const value = String(element.settings[key] ?? "");
            return value && animationIds.has(value);
          });

          if (assigned.length === 0) {
            diagnostics.push({
              id: `${object.id}:${element.id}:no-clips`,
              severity: "warning",
              message: `${object.name} has Directional Animation but no animation clips are assigned.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          }
        }

        if (element.type === "animated-sprite") {
          const defaultClipId = String(element.settings.defaultClipId ?? "").trim();
          const setId = String(element.settings.animationSetId ?? "").trim();
          if (defaultClipId && !animationIds.has(defaultClipId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-default-clip`, severity: "error", message: `${object.name} references missing default Animation Clip “${defaultClipId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          if (setId && !animationSetIds.has(setId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-animation-set`, severity: "error", message: `${object.name} references missing Animation Set “${setId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          if (!defaultClipId && !setId && !object.components.some((candidate) => candidate.enabled && (candidate.type === "directional-animation" || candidate.type === "animation-state-machine"))) diagnostics.push({ id: `${object.id}:${element.id}:no-animation-source`, severity: "warning", message: `${object.name} has Animated Sprite but no Animation Clip, Animation Set, or Animation Controller is assigned.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }

        if (element.type === "character-visual-controller") {
          const setId = String(element.settings.animationSetId ?? "").trim();
          if (setId && !animationSetIds.has(setId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-animation-set`, severity: "error", message: `${object.name} Character Visual Controller references missing Animation Set “${setId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }

        if (element.type === "player-input") {
          for (const key of [
            "moveUpAction",
            "moveDownAction",
            "moveLeftAction",
            "moveRightAction",
            "interactionAction",
          ]) {
            const actionId = String(element.settings[key] ?? "");
            if (actionId && !inputActionIds.has(actionId)) {
              diagnostics.push({
                id: `${object.id}:${element.id}:missing-input:${key}`,
                severity: "error",
                message: `${object.name} references the missing input action “${actionId}”.`,
                sceneId: scene.id,
                objectId: object.id,
                componentId: element.id,
              });
            }
          }
        }

        if (element.type === "box-collider" || element.type === "circle-collider" || element.type === "polygon-collider") {
          const polygonPoints = element.type === "polygon-collider"
            ? String(element.settings.points ?? "").split(";").map((pair) => pair.split(",").map((value) => Number(value.trim()))).filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
            : [];
          const width = element.type === "circle-collider" ? Number(element.settings.radius ?? 0) * 2 : element.type === "polygon-collider" ? (polygonPoints.length >= 3 ? 1 : 0) : Number(element.settings.width ?? 0);
          const height = element.type === "circle-collider" ? Number(element.settings.radius ?? 0) * 2 : element.type === "polygon-collider" ? (polygonPoints.length >= 3 ? 1 : 0) : Number(element.settings.height ?? 0);
          const layer = String(element.settings.layer ?? "World");
          if (!collisionLayers.has(layer)) {
            diagnostics.push({
              id: `${object.id}:${element.id}:invalid-layer`,
              severity: "error",
              message: `${object.name} uses the unknown collision layer “${layer}”.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          }
          if (width <= 0 || height <= 0) {
            diagnostics.push({
              id: `${object.id}:${element.id}:invalid-collider`,
              severity: "error",
              message: `${object.name} has an invalid ${element.type === "circle-collider" ? "circle collider radius" : element.type === "polygon-collider" ? "polygon collider point list" : "collider size"}.`,
              sceneId: scene.id,
              objectId: object.id,
              componentId: element.id,
            });
          }
        }

        if (element.type === "audio-source") {
          const assetId = String(element.settings.assetId ?? "");
          if (assetId && !audioAssetIds.has(assetId)) {
            diagnostics.push({ id: `${object.id}:${element.id}:invalid-audio`, severity: "error", message: `${object.name} references a missing or non-audio asset.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
        }

        if (element.type === "teleporter") {
          const destination = String(element.settings.destinationSceneId ?? "").trim();
          if (destination && !sceneIds.has(destination)) {
            diagnostics.push({ id: `${object.id}:${element.id}:invalid-teleporter-scene`, severity: "error", message: `${object.name} teleports to a scene that no longer exists.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
          const targetObjectName = String(element.settings.targetObjectName ?? "").trim();
          if (!destination && targetObjectName && !scene.objects.some((candidate) => candidate.name === targetObjectName)) {
            diagnostics.push({ id: `${object.id}:${element.id}:invalid-teleporter-target`, severity: "warning", message: `${object.name} targets object “${targetObjectName}”, which does not exist in ${scene.name}.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
        }

        if (element.type === "scene-exit") {
          const destination = String(element.settings.destinationSceneId ?? "");
          if (!destination || !sceneIds.has(destination)) {
            diagnostics.push({ id: `${object.id}:${element.id}:invalid-exit`, severity: "error", message: `${object.name} does not have a valid destination scene.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          } else {
            const destinationSpawnId = String(element.settings.destinationSpawnId ?? "").trim();
            if (destinationSpawnId) {
              const destinationScene = project.scenes.find((candidate) => candidate.id === destination);
              const exists = destinationScene?.objects.some((candidate) => candidate.components.some((candidateElement) => candidateElement.type === "scene-spawn-point" && candidateElement.enabled && String(candidateElement.settings.spawnId ?? "default").trim() === destinationSpawnId));
              if (!exists) diagnostics.push({ id: `${object.id}:${element.id}:missing-spawn`, severity: "error", message: `${object.name} targets missing spawn point “${destinationSpawnId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
            }
          }
        }

        if (element.type === "camera") {
          const fov = Number(element.settings.fieldOfView ?? 60);
          if (!Number.isFinite(fov) || fov < 20 || fov > 160) diagnostics.push({ id: `${object.id}:${element.id}:invalid-fov`, severity: "error", message: `${object.name} has a camera field of view outside the supported 20°–160° range.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          if (element.settings.clampToBounds === true) {
            const left = Number(element.settings.boundsLeft ?? -640), top = Number(element.settings.boundsTop ?? -360), right = Number(element.settings.boundsRight ?? 640), bottom = Number(element.settings.boundsBottom ?? 360);
            if (!(left < right && top < bottom)) diagnostics.push({ id: `${object.id}:${element.id}:invalid-camera-bounds`, severity: "error", message: `${object.name} has invalid camera bounds. Left/top must be smaller than right/bottom.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
        }

        if (element.type === "ui-menu-screen") {
          const backgroundAssetId = String(element.settings.backgroundAssetId ?? "").trim();
          if (backgroundAssetId && !assetIds.has(backgroundAssetId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-menu-background`, severity: "error", message: `${object.name} references a menu background image that no longer exists.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }

        if (element.type === "ui-menu-item") {
          const action = String(element.settings.action ?? "none");
          const targetScreenId = String(element.settings.targetScreenId ?? "").trim();
          if (["open-screen", "replace-screen", "toggle-screen"].includes(action) && (!targetScreenId || !menuScreenIds.has(targetScreenId))) {
            diagnostics.push({ id: `${object.id}:${element.id}:missing-menu-target`, severity: "error", message: `${object.name} targets a UI screen that does not exist in ${scene.name}.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
          const destinationSceneId = String(element.settings.destinationSceneId ?? "").trim();
          if (action === "change-scene" && (!destinationSceneId || !sceneIds.has(destinationSceneId))) {
            diagnostics.push({ id: `${object.id}:${element.id}:missing-menu-scene`, severity: "error", message: `${object.name} changes to a scene that no longer exists.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
          for (const key of ["navigationSoundAssetId", "confirmSoundAssetId"]) {
            const soundId = String(element.settings[key] ?? "").trim();
            if (soundId && !audioAssetIds.has(soundId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-${key}`, severity: "error", message: `${object.name} references a missing interface sound.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
        }

        if (element.type === "ui-input-glyph") {
          const actionId = String(element.settings.actionId ?? "").trim();
          if (actionId && !inputActionIds.has(actionId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-glyph-input`, severity: "error", message: `${object.name} displays a missing input action “${actionId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }

        if (element.type === "ui-image") {
          const assetId = String(element.settings.assetId ?? "").trim();
          if (assetId && !assetIds.has(assetId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-ui-image`, severity: "error", message: `${object.name} references a UI image that no longer exists.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }

        if (element.type === "tilemap-renderer") {
          try {
            const cells = JSON.parse(String(element.settings.cells ?? "{}")) as Record<string, string>;
            for (const tileId of new Set(Object.values(cells))) {
              if (tileId && !tileIds.has(tileId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-tile:${tileId}`, severity: "error", message: `${object.name} contains painted cells referencing a deleted tile.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
            }
          } catch {
            diagnostics.push({ id: `${object.id}:${element.id}:invalid-tilemap`, severity: "error", message: `${object.name} contains invalid tile cell data.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
          }
        }

        if (["hitbox", "damage-dealer", "attack", "weapon", "projectile", "hazard"].includes(element.type)) {
          const damageTypeId = String(element.settings.damageTypeId ?? element.settings.damageType ?? "physical");
          if (damageTypeId && !damageTypeIds.has(damageTypeId)) diagnostics.push({ id: `${object.id}:${element.id}:missing-damage-type`, severity: "error", message: `${object.name} references missing damage type “${damageTypeId}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }
        if (element.type === "ability-user" || element.type === "use-ability" || element.type === "attack-target") {
          const ids = String(element.settings.abilityIds ?? element.settings.abilityId ?? "").split(/[;,]/).map((value) => value.trim()).filter(Boolean);
          for (const id of ids) if (!abilityIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-ability:${id}`, severity: "error", message: `${object.name} references missing Ability “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }
        if (element.type === "loot-dropper" || element.type === "death-behaviour") {
          const id = String(element.settings.lootTableId ?? "").trim();
          if (id && !lootTableIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-loot-table`, severity: "error", message: `${object.name} references missing Loot Table “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });
        }
        if (element.type === "experience") { const id = String(element.settings.curveId ?? "").trim(); if (id && !experienceCurveIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-experience-curve`, severity: "error", message: `${object.name} references missing Experience Curve “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id }); }
        if (element.type === "upgrade-controller") { const id = String(element.settings.upgradeTreeId ?? "").trim(); if (id && !upgradeTreeIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-upgrade-tree`, severity: "error", message: `${object.name} references missing Upgrade Tree “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id }); }
        if (element.type === "script") { const id = String(element.settings.scriptId ?? "").trim(); if (id && !scriptIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-script`, severity: "error", message: `${object.name} references missing Shadowium Script “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id }); }
        if (element.type === "material-stack" || element.type === "post-process-volume") for (const id of String(element.settings.materialIds ?? "").split(/[;,]/).map((value) => value.trim()).filter(Boolean)) if (!materialIds.has(id)) diagnostics.push({ id: `${object.id}:${element.id}:missing-material:${id}`, severity: "error", message: `${object.name} references missing Material “${id}”.`, sceneId: scene.id, objectId: object.id, componentId: element.id });

        if (element.type === "interaction" && !ruleTargets.has(object.id) && !object.components.some((candidate) => ["item-pickup", "scene-exit", "dialogue-speaker", "door", "switch", "teleporter"].includes(candidate.type))) {
          diagnostics.push({
            id: `${object.id}:${element.id}:unused-interaction`,
            severity: "warning",
            message: `${object.name} can be interacted with, but no event rule listens for it.`,
            sceneId: scene.id,
            objectId: object.id,
            componentId: element.id,
          });
        }
      }
    }
  }

  for (const rule of project.eventRules) {
    const referencedObjects = [
      rule.trigger.sourceObjectId,
      rule.trigger.targetObjectId,
      ...rule.conditions.map((condition) => condition.objectId),
      ...rule.actions.map((action) => action.objectId),
    ].filter((value): value is string => Boolean(value));

    for (const objectId of referencedObjects) {
      const exists = project.scenes.some((scene) =>
        scene.objects.some((object) => object.id === objectId),
      );

      if (!exists) {
        diagnostics.push({
          id: `${rule.id}:missing-object:${objectId}`,
          severity: "error",
          message: `Event rule “${rule.name}” references an object that no longer exists.`,
          sceneId: null,
          objectId: null,
          componentId: null,
        });
      }
    }
    for (const action of rule.actions) {
      if (action.type === "change-scene" && (!action.sceneId || !sceneIds.has(action.sceneId))) {
        diagnostics.push({ id: `${rule.id}:${action.id}:missing-scene`, severity: "error", message: `Event rule “${rule.name}” changes to a scene that no longer exists.`, sceneId: null, objectId: null, componentId: null });
      }
    }
  }

  return diagnostics;
}

export const COMPONENT_TYPES: ComponentType[] = COMPONENT_CATALOG.map((definition) => definition.type);
/** Legacy source compatibility for Phase 2–7 tooling. */
export const ELEMENT_TYPES: ComponentType[] = COMPONENT_TYPES;
