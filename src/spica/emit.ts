import app from './target/SettingsApp.tsx?raw';
import uiTheme from './target/SpicaUiTheme.tsx?raw';
import uiAction from './target/ui/buttons/SpicaAction.tsx?raw';
import uiTextInput from './target/ui/fields/SpicaTextInput.tsx?raw';
import uiOptionSelect from './target/ui/fields/SpicaOptionSelect.tsx?raw';
import uiToggle from './target/ui/fields/SpicaToggle.tsx?raw';
import collection from './target/CollectionApp.tsx?raw';
import renderer from './target/SpicaApp.tsx?raw';
import workflow from './target/WorkflowApp.tsx?raw';
import modelLibrary from './target/ModelLibrary.tsx?raw';
import gameApp from './target/GameApp.tsx?raw';
import scenarios from './target/scenario.ts?raw';
import css from './target/settings.css?raw';
import entry from './target/entry.txt?raw';
import webEntry from './target/web-entry.txt?raw';
import native from './target/main.rs?raw';
import records from './target/records.rs?raw';
import nativeSupport from './target/native_support.rs?raw';
import build from './target/build.rs?raw';
import graphSource from './graph.ts?raw';
import appearanceSource from './appearance.ts?raw';
import programSource from './program.ts?raw';
import dataSource from './data.ts?raw';
import meshSource from './mesh.ts?raw';
import gameSource from './game.ts?raw';
import shadowiumSpatial from '../varmover/editor/spatial.ts?raw';
import shadowiumTypes from '../varmover/editor/types.ts?raw';
import { appearanceCss, STANDALONE_STYLE_SCOPE } from './appearance';
import { compileGraph, stableGraphJson } from './graph';
import type { SpicaProject } from './repository';
import { blockRegistry } from './program';
import { inlineLegacyBlockRegistry } from './runtime/blocks/standalone';

export const TARGET_VERSION = 1;
export const OWNERSHIP_PATH = 'spica-export.json';
export const CUSTOM_PATH = 'src/custom.js';
export const customSource = `// User-owned. SPICA keeps this module on every export.
// This hook provides the footer content and can return a React element.
export function footerLabel(plan) {
  return plan.collection?.label ?? plan.pages.length + ' settings pages';
}
`;
const json = (data: unknown) => JSON.stringify(data, null, 2) + '\n';
export const releaseVersion = (revision: number) => '0.1.' + revision;
export const productName = (appId: string) => 'Spica App ' + appId.slice(0, 12);

export function emitTauri(project: SpicaProject): Record<string, string> {
  const plan = compileGraph(project.graph);
  // Inline the shared modules into the established managed paths. The first
  // export fits one native write batch and older receipts retain their paths.
  const body = (source: string) => source.replace(/^(?:import |export type \{.*\} from ).*\r?\n/gm, '');
  const styleNonce = 'spica-style-' + project.appId;
  const frontend = "import React, { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';\n" +
    "import { Button, Checkbox, FormControl, FormControlLabel, NativeSelect, TextField, createTheme, ThemeProvider, useMediaQuery, Accordion, AccordionDetails, AccordionSummary } from '@mui/material';\n" +
    "import { CacheProvider } from '@emotion/react';\nimport createCache from '@emotion/cache';\n" +
    "import { appearanceCss, STANDALONE_STYLE_SCOPE, validPreferenceValue, allCollections, checkCapability, executeFlow, recordDefaults, recordProblem, matchesRecord, allRecords, exportRecords, prepareImport, stageImport, csvCellValue, readCsvTable, stageCsvRows, webAdapters, meshRenderer, readStl, stlLimit, compileGameScene, gameDirections, moveGame, type GameDirection, type GameScene, type Appearance, type AppPlan, type Collection, type CollectionField, type PreviewStyle, type Value, type RecordValue, type CollectionRecord, type CollectionStore, type CsvTransform, type FlowTrace, type Program, type RecordSort, type RecordTable, type Scenario, type ScenarioStep, type Mesh } from './graph';\n" +
    `const APP_ID = ${JSON.stringify(project.appId)};\n` +
    [uiTheme, uiAction, uiTextInput, uiOptionSelect, uiToggle, app, collection, modelLibrary, gameApp, workflow, renderer, scenarios].map(body).concat(entry).join('\n');
  const standaloneProgram = inlineLegacyBlockRegistry(programSource, blockRegistry);
  const sceneContracts = `namespace Shadowium {\n${shadowiumTypes}\n}\ntype Vector2 = Shadowium.Vector2;\ntype GameObjectDocument = Shadowium.GameObjectDocument;\n`;
  const stylesheet = css + '\nbody{margin:0}\n#root>.spica-frame>.spica-app{min-height:100vh}\n' +
    appearanceCss(plan.appearance, STANDALONE_STYLE_SCOPE) + '\n';
  return {
    'package.json': json({
      name: 'spica-app', version: '0.1.0', private: true, type: 'module',
      scripts: {
        build: 'vite build', 'build:web': 'vite build --base ./ --outDir dist-web',
        'build:desktop': 'tauri build --debug --no-bundle -- --locked --offline',
        'test:native': 'cargo test --locked --offline --manifest-path src-tauri/Cargo.toml',
        'package:windows': 'tauri build --debug --bundles nsis -- --locked --offline',
        'setup:locked': 'npm ci --offline --ignore-scripts',
        'check:toolchain': 'node --version && npm --version && rustc --version && cargo --version',
        'setup:native': 'cargo generate-lockfile --offline --manifest-path src-tauri/Cargo.toml',
      },
      dependencies: { react: '19.3.0', 'react-dom': '19.3.0', '@tauri-apps/api': '2.12.2',
        '@mui/material': '^7.3.0', '@emotion/react': '^11.14.0', '@emotion/styled': '^11.14.0', '@emotion/cache': '^11.14.0' },
      devDependencies: { vite: '7.3.7', '@tauri-apps/cli': '2.12.1' },
    }),
    'index.html': `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="spica-style-nonce" content="${styleNonce}"><title>SPICA app</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`,
    'src/main.tsx': frontend,
    'src/graph.ts': [appearanceSource, graphSource, standaloneProgram, dataSource, meshSource, sceneContracts, shadowiumSpatial, gameSource].map(body).join('\n'),
    'src/settings.css': stylesheet,
    'src/plan.json': stableGraphJson(plan, 2) + '\n',
    'src-tauri/Cargo.toml': `[package]
name = "spica-app"
version = "0.1.0"
edition = "2021"
[build-dependencies]
tauri-build = { version = "=2.7.1", features = [] }
[dependencies]
tauri = { version = "=2.12.2", features = [] }
serde = { version = "=1.0.229", features = ["derive"] }
serde_json = "=1.0.151"
sqlx = { version = "=0.8.6", default-features = false, features = ["sqlite", "runtime-tokio"] }
[target.'cfg(windows)'.dependencies]
rfd = { version = "=0.16.0", default-features = false }
[features]
custom-protocol = ["tauri/custom-protocol"]
`,
    'src-tauri/build.rs': build,
    'src-tauri/src/main.rs': native + '\nmod records {\n' + records + '\n}\nmod native_support {\n' + nativeSupport + '\n}\n',
    'src-tauri/tauri.conf.json': json({
      productName: productName(project.appId), mainBinaryName: 'spica-app', version: releaseVersion(project.revision), identifier: 'local.spica.' + project.appId,
      build: { beforeBuildCommand: 'npm run build', frontendDist: '../dist' },
      app: {
        windows: [{ label: 'main', title: plan.name, width: 820, height: 580, minWidth: 430, minHeight: 400 }],
        security: { csp: `default-src 'self'; connect-src ipc: http://ipc.localhost; style-src 'self' 'nonce-${styleNonce}'` },
      },
      bundle: { active: true, targets: ['nsis'], windows: { webviewInstallMode: { type: 'skip' }, nsis: { installMode: 'currentUser' } } },
    }),
  };
}


/** Browser-only output with explicit independent dependencies and no Tauri source or imports.
 * Uses the same verified schema-1 renderer as emitTauri, but swaps its native bridge
 * for IndexedDB and browser downloads. Must be preflighted via lowerSpicaTarget.
 */
export function emitWeb(project: SpicaProject): Record<string, string> {
  const desktop = emitTauri(project);
  const sourceFile = (path: string): string => {
    const content = desktop[path];
    if (content === undefined) throw new Error(`SPICA web emitter: missing generated source file ${path}.`);
    return content;
  };
  const generatedMain = sourceFile('src/main.tsx');
  if (!generatedMain.endsWith(entry)) throw Error('SPICA web emitter: native entry boundary changed. Update the target template.');
  const styleNonce = 'spica-style-' + project.appId;
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="spica-style-nonce" content="${styleNonce}"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'nonce-${styleNonce}'; font-src 'self' data:"><title>SPICA Web</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`;
  return {
    'package.json': json({
      name: 'spica-web-app', private: true, version: releaseVersion(project.revision), type: 'module',
      scripts: { build: 'vite build --base ./ --outDir dist-web', 'build:web': 'vite build --base ./ --outDir dist-web',
        'test:web': 'node scripts/verify-web-build.mjs', 'setup:locked': 'npm ci --offline --ignore-scripts' },
      dependencies: { react: '^19.1.0', 'react-dom': '^19.1.0', '@mui/material': '^7.3.0',
        '@emotion/react': '^11.14.0', '@emotion/styled': '^11.14.0', '@emotion/cache': '^11.14.0' },
      devDependencies: { vite: '^7.0.0', typescript: '~5.8.3' },
    }),
    'index.html': html,
    'src/main.tsx': generatedMain.slice(0, -entry.length) + webEntry,
    'src/graph.ts': sourceFile('src/graph.ts'),
    'src/settings.css': sourceFile('src/settings.css'),
    'src/plan.json': sourceFile('src/plan.json'),
    'scripts/verify-web-build.mjs': webBuildVerifier,
  };
}

const webBuildVerifier = `// SPICA generated verification: checks real Vite outputs, not a simulated build.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist-web');
const html = path.join(root, 'index.html');
if (!fs.existsSync(html)) throw Error('SPICA web build has no dist-web/index.html. Run npm run build:web first.');
const content = fs.readFileSync(html, 'utf8');
const scripts = [...content.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/g)].map(m => m[1]);
if (!scripts.length) throw Error('SPICA web build has no compiled JS entry.');
for (const asset of scripts) {
  const local = path.resolve(root, asset.replace(/^\.\//, '').replace(/^\//, ''));
  if (!local.startsWith(root + path.sep) || !fs.statSync(local).isFile() || fs.statSync(local).size < 100) {
    throw Error('Web bundle is missing or invalid: ' + asset);
  }
}
if (!content.includes('spica-style-nonce') || !content.includes('Content-Security-Policy')) {
  throw Error('SPICA web security metadata missing from built index.html.');
}
console.log('SPICA web static bundle verified: ' + scripts.length + ' compiled script asset(s).');
`;
