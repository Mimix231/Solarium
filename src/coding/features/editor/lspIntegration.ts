import type { editor, Position } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { api } from "../../integration/api";
import { useSettingsStore } from "../../stores/settingsStore";


interface ProtocolPosition {line:number;character:number}
interface ProtocolRange {start:ProtocolPosition;end:ProtocolPosition}
interface TextEdit {range?:ProtocolRange;newText:string}
interface CompletionItem {label:string|{label:string};detail?:string;documentation?:unknown;sortText?:string;filterText?:string;insertText?:string;insertTextFormat?:number;textEdit?:TextEdit}
type CompletionResponse=CompletionItem[]|{items?:CompletionItem[]};
interface Hover {contents:unknown;range?:ProtocolRange}
interface Location {uri?:string;targetUri?:string;range?:ProtocolRange;targetSelectionRange?:ProtocolRange;targetRange?:ProtocolRange}

let registered = false;

const supported = ["typescript", "javascript", "python", "rust", "c", "cpp"];

function textDocument(model: { uri: { toString(): string } }) {
  return { uri: model.uri.toString() };
}

function lspPosition(position: { lineNumber:number; column:number }) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function range(monaco: Monaco, value: ProtocolRange | TextEdit | undefined, fallback: { lineNumber:number; column:number }) {
  const r = value && "range" in value ? value.range : value as ProtocolRange|undefined;
  if (r?.start && r?.end) {
    return new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1);
  }
  return new monaco.Range(fallback.lineNumber, fallback.column, fallback.lineNumber, fallback.column);
}

function markdown(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(markdown).join("\n\n");
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.value === "string") return object.value;
    if (typeof object.language === "string" && typeof object.value === "string") return `\`\`\`${object.language}\n${object.value}\n\`\`\``;
  }
  return "";
}

function enabled(){return useSettingsStore.getState().settings.lspEnabled;}

export function registerGlitchLsp(monaco: Monaco) {
  if (registered) return;
  registered = true;

  for (const language of supported) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [".", ":", "(", "\"", "'", "/", "<"],
      provideCompletionItems: async (model:editor.ITextModel, position:Position) => {
        if(!enabled()||model.uri.scheme!=='file')return {suggestions:[]};
        try {
          const response = await api.lspRequest<CompletionResponse>(model.uri.fsPath, "textDocument/completion", {
            textDocument: textDocument(model), position: lspPosition(position), context: { triggerKind: 1 },
          }, model.getLanguageId());
          if (!response.available || !response.result) return { suggestions: [] };
          const source = Array.isArray(response.result) ? response.result : response.result.items ?? [];
          const suggestions = source.map((item: CompletionItem) => {
            const label = typeof item.label === "string" ? item.label : String(item.label?.label ?? "completion");
            const edit = item.textEdit;
            return {
              label,
              kind: monaco.languages.CompletionItemKind.Text,
              detail: item.detail,
              documentation: item.documentation ? { value: markdown(item.documentation) } : undefined,
              sortText: item.sortText,
              filterText: item.filterText,
              insertText: String(edit?.newText ?? item.insertText ?? label),
              insertTextRules: item.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
              range: range(monaco, edit, position),
            };
          });
          return { suggestions };
        } catch { return { suggestions: [] }; }
      },
    });

    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model:editor.ITextModel, position:Position) => {
        if(!enabled()||model.uri.scheme!=='file')return null;
        try {
          const response = await api.lspRequest<Hover>(model.uri.fsPath, "textDocument/hover", {
            textDocument: textDocument(model), position: lspPosition(position),
          }, model.getLanguageId());
          const hover = response.result;
          if (!response.available || !hover) return null;
          const value = markdown(hover.contents);
          if (!value) return null;
          return { contents: [{ value }], range: hover.range ? range(monaco, hover.range, position) : undefined };
        } catch { return null; }
      },
    });

    monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: async (model:editor.ITextModel, position:Position) => {
        if(!enabled()||model.uri.scheme!=='file')return null;
        try {
          const response = await api.lspRequest<Location|Location[]>(model.uri.fsPath, "textDocument/definition", {
            textDocument: textDocument(model), position: lspPosition(position),
          }, model.getLanguageId());
          if (!response.available || !response.result) return null;
          const values = Array.isArray(response.result) ? response.result : [response.result];
          return values.map((item: Location) => {
            const uri = item.targetUri ?? item.uri;
            const targetRange = item.targetSelectionRange ?? item.targetRange ?? item.range;
            return { uri: monaco.Uri.parse(uri??''), range: range(monaco, targetRange, position) };
          });
        } catch { return null; }
      },
    });

    monaco.languages.registerReferenceProvider(language, {
      provideReferences: async (model:editor.ITextModel, position:Position) => {
        if(!enabled()||model.uri.scheme!=='file')return [];
        try {
          const response = await api.lspRequest<Location[]>(model.uri.fsPath, "textDocument/references", {
            textDocument: textDocument(model), position: lspPosition(position), context: { includeDeclaration: true },
          }, model.getLanguageId());
          if (!response.available || !Array.isArray(response.result)) return [];
          return response.result.map((item: Location) => ({ uri: monaco.Uri.parse(item.uri??''), range: range(monaco, item.range, position) }));
        } catch { return []; }
      },
    });
  }
}
