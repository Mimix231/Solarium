import type { JsonPrimitive, ScriptDefinition } from "./types";

export type LeonisScriptCallback =
  | "on_start"
  | "on_update"
  | "on_fixed_update"
  | "on_collision_enter"
  | "on_collision_exit"
  | "on_trigger_enter"
  | "on_trigger_exit"
  | "on_damage"
  | "on_interact"
  | "on_event"
  | "on_destroy";

export interface LeonisScriptCommand {
  name: string;
  args: JsonPrimitive[];
  line: number;
}

export interface LeonisScriptFunction {
  name: LeonisScriptCallback | string;
  parameters: string[];
  commands: LeonisScriptCommand[];
}

export interface CompiledLeonisScript {
  scriptId: string;
  name: string;
  functions: Map<string, LeonisScriptFunction>;
  errors: LeonisScriptDiagnostic[];
}

export interface LeonisScriptDiagnostic {
  severity: "warning" | "error";
  line: number;
  message: string;
}

export interface LeonisScriptInvocation {
  callback: LeonisScriptCallback | string;
  arguments?: Record<string, JsonPrimitive>;
  operationLimit?: number;
}

export interface LeonisScriptHost {
  getVariable(key: string): JsonPrimitive;
  setVariable(key: string, value: JsonPrimitive): void;
  getHealthPercent(): number;
  damage(amount: number, damageTypeId?: string): void;
  heal(amount: number): void;
  setAiState(state: string): void;
  castAbility(abilityId: string): void;
  addCurrency(currencyId: string, amount: number): void;
  awardExperience(amount: number): void;
  emit(eventName: string, value?: JsonPrimitive): void;
  log(message: string): void;
}

export interface LeonisScriptResult {
  operations: number;
  errors: LeonisScriptDiagnostic[];
}

const ALLOWED_COMMANDS = new Set([
  "log",
  "set_variable",
  "emit",
  "ai_set_state",
  "damage",
  "heal",
  "cast_ability",
  "add_currency",
  "award_experience",
]);

function stripComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let quote: "\"" | "'" | null = null;
      let escaped = false;
      for (let index = 0; index < line.length - 1; index += 1) {
        const character = line[index];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (character === "\\" && quote) {
          escaped = true;
          continue;
        }
        if (quote) {
          if (character === quote) quote = null;
          continue;
        }
        if (character === "\"" || character === "'") {
          quote = character;
          continue;
        }
        if (character === "/" && line[index + 1] === "/") return line.slice(0, index);
      }
      return line;
    })
    .join("\n");
}

function splitStatements(body: string): Array<{ text: string; lineOffset: number }> {
  const result: Array<{ text: string; lineOffset: number }> = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  let depth = 0;
  let lineOffset = 0;
  let statementLineOffset = 0;

  const flush = () => {
    const text = current.trim();
    if (text) result.push({ text, lineOffset: statementLineOffset });
    current = "";
    statementLineOffset = lineOffset;
  };

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote) {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      if (character === "\n") lineOffset += 1;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);

    if ((character === ";" || character === "\n") && depth === 0) {
      flush();
      if (character === "\n") {
        lineOffset += 1;
        statementLineOffset = lineOffset;
      }
      continue;
    }
    current += character;
  }
  flush();
  return result;
}

function splitArguments(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let depth = 0;
  for (const character of text) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parsePrimitive(text: string): JsonPrimitive {
  const value = text.trim();
  if (!value) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function parseCommands(body: string, startLine: number, diagnostics: LeonisScriptDiagnostic[]): LeonisScriptCommand[] {
  const commands: LeonisScriptCommand[] = [];
  for (const entry of splitStatements(body)) {
    const statement = entry.text;
    if (!statement || statement === "{" || statement === "}") continue;
    const line = startLine + entry.lineOffset;
    const match = statement.match(/^([a-zA-Z_][\w]*)\s*\((.*)\)$/s);
    if (!match) {
      diagnostics.push({ severity: "error", line, message: `Unsupported statement: ${statement}` });
      continue;
    }
    const name = match[1];
    if (!ALLOWED_COMMANDS.has(name)) {
      diagnostics.push({ severity: "error", line, message: `Command “${name}” is not available in the Shadowium Script sandbox.` });
      continue;
    }
    commands.push({ name, args: splitArguments(match[2]).map(parsePrimitive), line });
  }
  return commands;
}

export function compileLeonisScript(script: ScriptDefinition): CompiledLeonisScript {
  const source = stripComments(script.source ?? "");
  const diagnostics: LeonisScriptDiagnostic[] = [];
  const functions = new Map<string, LeonisScriptFunction>();
  const functionPattern = /fn\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;
  while ((match = functionPattern.exec(source))) {
    const name = match[1];
    const line = source.slice(0, match.index).split("\n").length;
    if (functions.has(name)) diagnostics.push({ severity: "error", line, message: `Function “${name}” is declared more than once.` });
    functions.set(name, {
      name,
      parameters: match[2].split(",").map((entry) => entry.trim()).filter(Boolean),
      commands: parseCommands(match[3], line, diagnostics),
    });
  }
  if (!functions.size && source.trim()) diagnostics.push({ severity: "error", line: 1, message: "No function declarations were found. Use: fn on_start() { ... }" });
  return { scriptId: script.id, name: script.name, functions, errors: diagnostics };
}

function resolveArgument(value: JsonPrimitive, invocation: LeonisScriptInvocation): JsonPrimitive {
  if (typeof value !== "string") return value;
  if (value.startsWith("$")) return invocation.arguments?.[value.slice(1)] ?? null;
  return value;
}

export function runLeonisScript(
  compiled: CompiledLeonisScript,
  invocation: LeonisScriptInvocation,
  host: LeonisScriptHost,
): LeonisScriptResult {
  const errors = [...compiled.errors.filter((diagnostic) => diagnostic.severity === "error")];
  if (errors.length) return { operations: 0, errors };
  const target = compiled.functions.get(invocation.callback);
  if (!target) return { operations: 0, errors: [] };
  const operationLimit = Math.max(1, Math.min(10_000, invocation.operationLimit ?? 512));
  let operations = 0;
  for (const command of target.commands) {
    operations += 1;
    if (operations > operationLimit) {
      errors.push({ severity: "error", line: command.line, message: `Operation limit of ${operationLimit} was exceeded.` });
      break;
    }
    const args = command.args.map((value) => resolveArgument(value, invocation));
    try {
      switch (command.name) {
        case "log": host.log(String(args[0] ?? "")); break;
        case "set_variable": host.setVariable(String(args[0] ?? ""), args[1] ?? null); break;
        case "emit": host.emit(String(args[0] ?? "script-event"), args[1]); break;
        case "ai_set_state": host.setAiState(String(args[0] ?? "Idle")); break;
        case "damage": host.damage(Number(args[0] ?? 0), String(args[1] ?? "physical")); break;
        case "heal": host.heal(Number(args[0] ?? 0)); break;
        case "cast_ability": host.castAbility(String(args[0] ?? "")); break;
        case "add_currency": host.addCurrency(String(args[0] ?? "gold"), Number(args[1] ?? 0)); break;
        case "award_experience": host.awardExperience(Number(args[0] ?? 0)); break;
        default: break;
      }
    } catch (error) {
      errors.push({ severity: "error", line: command.line, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { operations, errors };
}

export const LEONIS_SCRIPT_SNIPPETS = {
  damageReaction: `fn on_damage() {\n  log("Damage received");\n  ai_set_state("Flee");\n}`,
  starter: `fn on_start() {\n  log("Game Object started");\n}\n\nfn on_update(delta) {\n  // Add approved Shadowium Script commands here.\n}`,
  reward: `fn on_event(name, value) {\n  add_currency("gold", 5);\n  award_experience(10);\n}`,
};
