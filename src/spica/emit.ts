import app from './target/SettingsApp.tsx?raw';
import collection from './target/CollectionApp.tsx?raw';
import renderer from './target/SpicaApp.tsx?raw';
import workflow from './target/WorkflowApp.tsx?raw';
import modelLibrary from './target/ModelLibrary.tsx?raw';
import scenarios from './target/scenario.ts?raw';
import css from './target/settings.css?raw';
import entry from './target/entry.txt?raw';
import native from './target/main.rs?raw';
import records from './target/records.rs?raw';
import nativeSupport from './target/native_support.rs?raw';
import build from './target/build.rs?raw';
import graphSource from './graph.ts?raw';
import appearanceSource from './appearance.ts?raw';
import programSource from './program.ts?raw';
import dataSource from './data.ts?raw';
import meshSource from './mesh.ts?raw';
import { appearanceCss, STANDALONE_STYLE_SCOPE } from './appearance';
import { compileGraph, stableGraphJson } from './graph';
import type { SpicaProject } from './repository';

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
  const frontend = "import React, { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';\n" +
    "import { appearanceCss, STANDALONE_STYLE_SCOPE, validPreferenceValue, allCollections, checkCapability, executeFlow, recordDefaults, allRecords, exportRecords, prepareImport, webAdapters, meshRenderer, readStl, stlLimit, type Appearance, type AppPlan, type Collection, type PreviewStyle, type Value, type RecordValue, type CollectionRecord, type CollectionStore, type CsvTransform, type FlowTrace, type Program, type Scenario, type ScenarioStep, type Mesh } from './graph';\n" +
    `const APP_ID = ${JSON.stringify(project.appId)};\n` +
    [app, collection, modelLibrary, workflow, renderer, scenarios].map(body).concat(entry).join('\n');
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
      dependencies: { react: '19.3.0', 'react-dom': '19.3.0', '@tauri-apps/api': '2.12.2' },
      devDependencies: { vite: '7.3.7', '@tauri-apps/cli': '2.12.1' },
    }),
    'index.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SPICA app</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
    'src/main.tsx': frontend,
    'src/graph.ts': [appearanceSource, graphSource, programSource, dataSource, meshSource].map(body).join('\n'),
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
        security: { csp: "default-src 'self'; connect-src ipc: http://ipc.localhost; style-src 'self'" },
      },
      bundle: { active: true, targets: ['nsis'], windows: { webviewInstallMode: { type: 'skip' }, nsis: { installMode: 'currentUser' } } },
    }),
  };
}

