import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
(self as typeof self & {MonacoEnvironment:monaco.Environment}).MonacoEnvironment={getWorker:(_module,label)=>label==='typescript'||label==='javascript'?new TypeScriptWorker():label==='json'?new JsonWorker():['css','scss','less'].includes(label)?new CssWorker():['html','handlebars','razor'].includes(label)?new HtmlWorker():new EditorWorker()};
loader.config({monaco});
