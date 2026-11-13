import type {
  AbilityDefinition,
  ComponentInstance,
  DamageTypeDefinition,
  ExperienceCurveDefinition,
  GameObjectDocument,
  JsonPrimitive,
  LootTableDefinition,
  ProjectDocument,
  StatDefinition,
  StatusEffectDefinition,
} from "./types";

export interface RuntimeStatusInstance {
  id: string;
  remainingSeconds: number;
  tickRemainingSeconds: number;
  stacks: number;
  sourceObjectId: string;
}

export interface RuntimeAbilityCast {
  abilityId: string;
  phase: "casting" | "channeling" | "finished" | "interrupted";
  remainingSeconds: number;
  targetObjectId: string | null;
  targetX: number;
  targetY: number;
}

export interface RuntimeCombatCalculation {
  sourceObjectId: string;
  targetObjectId: string;
  damageTypeId: string;
  baseAmount: number;
  resistance: number;
  statusMultiplier: number;
  critical: boolean;
  criticalMultiplier: number;
  shieldAbsorbed: number;
  finalAmount: number;
  healing: boolean;
}

export interface RuntimeLootResult {
  kind: "item" | "currency" | "experience" | "prefab" | "loot-table";
  referenceId: string;
  amount: number;
  entryId: string;
}

export interface RuntimeAiDecision {
  previousState: string;
  nextState: string;
  reason: string;
  targetObjectId: string | null;
  distance: number;
  lineOfSight: boolean;
  healthPercent: number;
}

export interface RuntimeProfilerFrame {
  at: number;
  frameMs: number;
  updateMs: number;
  physicsMs: number;
  aiMs: number;
  combatMs: number;
  scriptsMs: number;
  renderMs: number;
  activeObjects: number;
  activeComponents: number;
  drawCalls: number;
  particles: number;
  audioVoices: number;
}

export function componentOf(object: GameObjectDocument, type: string): ComponentInstance | undefined {
  return object.components.find((component) => component.enabled && component.type === type);
}

export function componentsOf(object: GameObjectDocument, type: string): ComponentInstance[] {
  return object.components.filter((component) => component.enabled && component.type === type);
}

export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  return String(value ?? "").split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean);
}

export function parseNumberMap(value: unknown): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, Number(entry) || 0]));
  }
  const text = String(value ?? "").trim();
  if (!text) return {};
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, Number(entry) || 0]));
    } catch { /* Fall through to key:value syntax. */ }
  }
  const result: Record<string, number> = {};
  for (const part of text.split(/[,;\n]/)) {
    const [key, raw] = part.split(":");
    if (!key?.trim()) continue;
    result[key.trim()] = Number(raw) || 0;
  }
  return result;
}

export function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function teamId(object: GameObjectDocument): string {
  return String(componentOf(object, "team")?.settings.teamId ?? "Neutral").trim() || "Neutral";
}

export function teamsAreHostile(source: GameObjectDocument, target: GameObjectDocument): boolean {
  const sourceTeam = componentOf(source, "team");
  const targetTeam = teamId(target);
  if (!sourceTeam) return source !== target;
  const ownTeam = String(sourceTeam.settings.teamId ?? "Neutral");
  if (ownTeam === targetTeam) return sourceTeam.settings.friendlyFire === true;
  const hostile = parseList(sourceTeam.settings.hostileTeams);
  if (hostile.length) return hostile.includes(targetTeam) || hostile.includes("*");
  const friendly = parseList(sourceTeam.settings.friendlyTeams);
  if (friendly.includes(targetTeam)) return false;
  return targetTeam !== "Neutral" && ownTeam !== "Neutral";
}

export function resistanceFor(object: GameObjectDocument, damageTypeId: string): number {
  const component = componentOf(object, "resistance");
  if (!component) return 0;
  if (parseList(component.settings.immunities).includes(damageTypeId)) return 1;
  const values = parseNumberMap(component.settings.values);
  const raw = Number(values[damageTypeId] ?? 0);
  return Math.max(-10, Math.min(1, raw > 1 || raw < -1 ? raw / 100 : raw));
}

export function statusDamageMultiplier(statuses: RuntimeStatusInstance[], definitions: StatusEffectDefinition[]): number {
  return statuses.reduce((total, status) => {
    const definition = definitions.find((candidate) => candidate.id === status.id);
    return total * Math.pow(definition?.damageMultiplier ?? 1, status.stacks);
  }, 1);
}

export function statusSpeedMultiplier(statuses: RuntimeStatusInstance[], definitions: StatusEffectDefinition[]): number {
  return statuses.reduce((total, status) => {
    const definition = definitions.find((candidate) => candidate.id === status.id);
    return total * Math.pow(definition?.speedMultiplier ?? 1, status.stacks);
  }, 1);
}

export function calculateDamage(input: {
  project: ProjectDocument;
  source: GameObjectDocument;
  target: GameObjectDocument;
  baseAmount: number;
  damageTypeId: string;
  targetStatuses: RuntimeStatusInstance[];
  sourceStats?: Record<string, number>;
  targetShield: number;
  random?: () => number;
}): RuntimeCombatCalculation {
  const { project, source, target, damageTypeId } = input;
  const damageType: DamageTypeDefinition | undefined = project.damageTypes.find((candidate) => candidate.id === damageTypeId);
  const healing = damageType?.healing === true || damageTypeId === "healing" || input.baseAmount < 0;
  const attackPower = Number(input.sourceStats?.["attack-power"] ?? 0);
  const baseAmount = Math.max(0, Math.abs(input.baseAmount) + (healing ? 0 : attackPower));
  const criticalChance = Math.max(0, Math.min(1, Number(input.sourceStats?.["critical-chance"] ?? 0)));
  const critical = !healing && (input.random ?? Math.random)() < criticalChance;
  const criticalMultiplier = critical ? Math.max(1, Number(input.sourceStats?.["critical-multiplier"] ?? 1.5)) : 1;
  const resistance = healing ? 0 : resistanceFor(target, damageTypeId);
  const statusMultiplier = statusDamageMultiplier(input.targetStatuses, project.statusEffects);
  const preShield = Math.max(0, baseAmount * criticalMultiplier * (1 - resistance) * statusMultiplier);
  const shieldAbsorbed = healing ? 0 : Math.min(Math.max(0, input.targetShield), preShield);
  return {
    sourceObjectId: source.id,
    targetObjectId: target.id,
    damageTypeId,
    baseAmount,
    resistance,
    statusMultiplier,
    critical,
    criticalMultiplier,
    shieldAbsorbed,
    finalAmount: Math.max(0, preShield - shieldAbsorbed),
    healing,
  };
}

export function applyOrStackStatus(existing: RuntimeStatusInstance[], definition: StatusEffectDefinition, sourceObjectId: string, requestedDuration?: number): RuntimeStatusInstance[] {
  const duration = Math.max(0, requestedDuration ?? definition.durationSeconds);
  const current = existing.find((status) => status.id === definition.id);
  if (!current) return [...existing, { id: definition.id, remainingSeconds: duration, tickRemainingSeconds: Math.max(0.001, definition.tickIntervalSeconds), stacks: 1, sourceObjectId }];
  if (definition.stacking === "ignore") return existing;
  if (definition.stacking === "refresh") current.remainingSeconds = Math.max(current.remainingSeconds, duration);
  else if (definition.stacking === "stack-duration") current.remainingSeconds += duration;
  else {
    current.stacks = Math.min(definition.maximumStacks, current.stacks + 1);
    current.remainingSeconds = Math.max(current.remainingSeconds, duration);
  }
  current.sourceObjectId = sourceObjectId;
  return [...existing];
}

export function updateStatuses(statuses: RuntimeStatusInstance[], definitions: StatusEffectDefinition[], deltaSeconds: number): { statuses: RuntimeStatusInstance[]; ticks: Array<{ status: StatusEffectDefinition; stacks: number; sourceObjectId: string }> } {
  const ticks: Array<{ status: StatusEffectDefinition; stacks: number; sourceObjectId: string }> = [];
  const next: RuntimeStatusInstance[] = [];
  for (const instance of statuses) {
    const definition = definitions.find((candidate) => candidate.id === instance.id);
    if (!definition) continue;
    instance.remainingSeconds -= deltaSeconds;
    if (definition.tickIntervalSeconds > 0) {
      instance.tickRemainingSeconds -= deltaSeconds;
      while (instance.tickRemainingSeconds <= 0 && instance.remainingSeconds > -definition.tickIntervalSeconds) {
        ticks.push({ status: definition, stacks: instance.stacks, sourceObjectId: instance.sourceObjectId });
        instance.tickRemainingSeconds += definition.tickIntervalSeconds;
      }
    }
    if (instance.remainingSeconds > 0) next.push(instance);
  }
  return { statuses: next, ticks };
}

export function evaluateFormula(formula: string, values: Record<string, number>): number {
  const source = formula.trim();
  if (!source) return 0;
  const tokens = source.match(/[A-Za-z_][A-Za-z0-9_-]*|\d*\.?\d+(?:e[+-]?\d+)?|[()+\-*/]/gi);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== source.replace(/\s/g, "")) return Number.NaN;
  const output: Array<number | string> = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  let previous: string | null = null;
  for (const token of tokens) {
    if (/^\d/.test(token) || /^\.\d/.test(token)) output.push(Number(token));
    else if (/^[A-Za-z_]/.test(token)) output.push(Number(values[token] ?? 0));
    else if (token === "(") operators.push(token);
    else if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") output.push(operators.pop()!);
      if (operators[operators.length - 1] === "(") operators.pop();
    } else {
      if (token === "-" && (previous === null || previous === "(" || previous in precedence)) output.push(0);
      while (operators.length && operators[operators.length - 1] !== "(" && precedence[operators[operators.length - 1]!] >= precedence[token]) output.push(operators.pop()!);
      operators.push(token);
    }
    previous = token;
  }
  while (operators.length) output.push(operators.pop()!);
  const stack: number[] = [];
  for (const token of output) {
    if (typeof token === "number") stack.push(token);
    else {
      const right = stack.pop() ?? 0;
      const left = stack.pop() ?? 0;
      stack.push(token === "+" ? left + right : token === "-" ? left - right : token === "*" ? left * right : right === 0 ? Number.NaN : left / right);
    }
  }
  return stack.length === 1 ? stack[0] : Number.NaN;
}

export function buildRuntimeStats(projectStats: StatDefinition[], componentValue: unknown, formulasValue: unknown): Record<string, number> {
  const values: Record<string, number> = Object.fromEntries(projectStats.map((stat) => [stat.id, stat.baseValue]));
  Object.assign(values, parseNumberMap(componentValue));
  const formulas = parseJsonRecord(formulasValue);
  for (let pass = 0; pass < Math.max(1, Object.keys(formulas).length); pass += 1) {
    for (const [statId, formula] of Object.entries(formulas)) {
      const result = evaluateFormula(String(formula), values);
      if (Number.isFinite(result)) values[statId] = result;
    }
  }
  for (const definition of projectStats) values[definition.id] = Math.max(definition.minimum, Math.min(definition.maximum, Number(values[definition.id] ?? definition.baseValue)));
  return values;
}

export function experienceRequired(curve: ExperienceCurveDefinition | undefined, level: number): number {
  if (!curve) return Math.max(1, level * 100);
  const clampedLevel = Math.max(1, Math.min(curve.maximumLevel, level));
  if (curve.formula === "linear") return Math.round(curve.baseExperience * clampedLevel * curve.growthFactor);
  if (curve.formula === "quadratic") return Math.round(curve.baseExperience * clampedLevel * clampedLevel * curve.growthFactor);
  return Math.round(curve.baseExperience * Math.pow(curve.growthFactor, clampedLevel - 1));
}

export function rollLootTable(project: ProjectDocument, table: LootTableDefinition, variables: Record<string, JsonPrimitive>, random: () => number = Math.random, depth = 0): RuntimeLootResult[] {
  if (depth > 8) return [];
  const eligible = table.entries.filter((entry) => !entry.conditionVariable || variables[entry.conditionVariable] === entry.conditionValue);
  const guaranteed = eligible.filter((entry) => entry.guaranteed);
  const weighted = eligible.filter((entry) => !entry.guaranteed && entry.weight > 0);
  const results: RuntimeLootResult[] = [];
  const add = (entry: typeof eligible[number]): void => {
    const amount = Math.max(0, Math.floor(entry.minimumAmount + random() * (Math.max(entry.minimumAmount, entry.maximumAmount) - entry.minimumAmount + 1)));
    if (entry.kind === "loot-table") {
      const nested = project.lootTables.find((candidate) => candidate.id === entry.referenceId);
      if (nested) results.push(...rollLootTable(project, nested, variables, random, depth + 1));
    } else if (amount > 0) results.push({ kind: entry.kind, referenceId: entry.referenceId, amount, entryId: entry.id });
  };
  guaranteed.forEach(add);
  for (let roll = 0; roll < Math.max(0, table.rolls); roll += 1) {
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) break;
    let cursor = random() * total;
    const entry = weighted.find((candidate) => (cursor -= candidate.weight) <= 0) ?? weighted[weighted.length - 1];
    if (entry) add(entry);
  }
  return results;
}

export function selectAbilityTargets<T extends { object: GameObjectDocument; x: number; y: number; enabled: boolean; destroyed: boolean }>(ability: AbilityDefinition, caster: T, objects: T[], explicitTarget: T | null, targetX: number, targetY: number): T[] {
  if (ability.targetingMode === "self") return [caster];
  const valid = objects.filter((candidate) => candidate.enabled && !candidate.destroyed && candidate !== caster && teamsAreHostile(caster.object, candidate.object));
  const sorted = valid.map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - (ability.targetingMode === "point" ? targetX : caster.x), candidate.y - (ability.targetingMode === "point" ? targetY : caster.y)) })).filter((entry) => entry.distance <= Math.max(ability.range, ability.effects.reduce((maximum, effect) => Math.max(maximum, effect.radius), 0))).sort((left, right) => left.distance - right.distance);
  if (explicitTarget && valid.includes(explicitTarget)) sorted.unshift({ candidate: explicitTarget, distance: 0 });
  const unique = [...new Map(sorted.map((entry) => [entry.candidate.object.id, entry.candidate])).values()];
  return unique.slice(0, Math.max(1, ability.maximumTargets));
}

export function chooseAiDecision(input: {
  object: GameObjectDocument;
  currentState: string;
  health: number | null;
  maximumHealth: number;
  target: { object: GameObjectDocument; x: number; y: number } | null;
  x: number;
  y: number;
  lineOfSight: boolean;
}): RuntimeAiDecision {
  const healthPercent = input.health === null ? 100 : input.maximumHealth <= 0 ? 0 : input.health / input.maximumHealth * 100;
  const distance = input.target ? Math.hypot(input.target.x - input.x, input.target.y - input.y) : Number.POSITIVE_INFINITY;
  const flee = componentOf(input.object, "flee-target");
  const attack = componentOf(input.object, "attack-target");
  const vision = componentOf(input.object, "vision-sensor");
  const guard = componentOf(input.object, "guard-area");
  let nextState = input.currentState || String(componentOf(input.object, "ai-controller")?.settings.initialState ?? "Idle");
  let reason = "No transition";
  if (healthPercent <= 0) { nextState = "Dead"; reason = "Health reached zero"; }
  else if (flee && healthPercent <= Number(flee.settings.healthThreshold ?? 25)) { nextState = "Flee"; reason = `Health ${healthPercent.toFixed(1)}% is below flee threshold`; }
  else if (nextState === "Flee" && flee && healthPercent >= Number(flee.settings.recoverThreshold ?? 50)) { nextState = input.target ? "Chase" : "Idle"; reason = `Health recovered to ${healthPercent.toFixed(1)}%`; }
  else if (input.target && input.lineOfSight && attack && distance <= Number(attack.settings.range ?? 64)) { nextState = "Attack"; reason = `Target is within attack range (${Math.round(distance)})`; }
  else if (input.target && input.lineOfSight && (!vision || distance <= Number(vision.settings.range ?? 320))) { nextState = "Chase"; reason = `Target perceived at ${Math.round(distance)} pixels`; }
  else if (!input.target && guard) { nextState = "Guard"; reason = "No target; guarding home area"; }
  else if (!input.target) { nextState = componentOf(input.object, "patrol") ? "Patrol" : componentOf(input.object, "wander") ? "Wander" : "Idle"; reason = "No perceived target"; }
  return { previousState: input.currentState, nextState, reason, targetObjectId: input.target?.object.id ?? null, distance, lineOfSight: input.lineOfSight, healthPercent };
}
