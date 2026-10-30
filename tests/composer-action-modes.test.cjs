const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decideToolPermission, taskGrantForTool } = require('../.test-dist/engine/action-permissions.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const root = path.join(__dirname, '..');
const source = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const decide = (mode, name, opts = {}) => decideToolPermission({mode, name, projectAttached: true, webEnabled: true, ...opts});

test('Ask asks for each available tool and cannot bypass explicitly blocked tools', () => {
  for (const name of ['inspect_project','read_project_file','apply_project_changes','replace_project_text','run_project_check','search_web']) {
    assert.equal(decide('ask', name), 'ask', name);
  }
  assert.equal(decide('ask', 'inspect_project', {configured:'deny'}), 'deny');
});

test('Auto permits safe reads, but asks once for file writes and executable project checks', () => {
  for (const name of ['inspect_project','read_project_file','list_project_files','search_project_code','calculate','search_web']) {
    assert.equal(decide('auto', name), 'allow', name);
  }
  assert.equal(decide('auto','run_project_check', {args:{check:'git_status'}}), 'allow');
  assert.equal(decide('auto','run_project_check', {args:{check:'git_diff'}}), 'allow');
  assert.equal(decide('auto','run_project_check', {args:{check:'npm_test'}}), 'ask');
  assert.equal(decide('auto','replace_project_text'), 'ask');
  assert.equal(decide('auto','apply_project_changes'), 'ask');
  const grants = new Set(['write','check']);
  assert.equal(decide('auto','replace_project_text',{taskGrants:grants}), 'allow');
  assert.equal(decide('auto','apply_project_changes',{taskGrants:grants}), 'allow');
  assert.equal(decide('auto','run_project_check',{args:{check:'npm_build'},taskGrants:grants}), 'allow');
  assert.equal(taskGrantForTool('replace_project_text', {}), 'write');
  assert.equal(taskGrantForTool('run_project_check', {check:'cargo_check'}), 'check');
  assert.equal(taskGrantForTool('run_project_check', {check:'git_diff'}), null);
});

test('YOLO authorizes only registered project tools within a linked folder; blocked/web-off still denied', () => {
  assert.equal(decide('yolo','apply_project_changes'), 'allow');
  assert.equal(decide('yolo','run_project_check'), 'allow');
  assert.equal(decide('yolo','search_web',{webEnabled:false}), 'deny');
  assert.equal(decide('yolo','apply_project_changes',{projectAttached:false}), 'deny');
  assert.equal(decide('yolo','run_shell',{projectAttached:true}), 'deny');
  assert.equal(decide('yolo','replace_project_text',{configured:'deny'}), 'deny');
  assert.equal(decide('auto','list_project_files',{projectAttached:false}), 'deny');
});

test('execution-mode preference migrates safely and persists through workspace validation', () => {
  const initial = defaultWorkspace();
  assert.equal(initial.preferences.actionMode, 'ask');
  assert.equal(validateWorkspace(initial).preferences.actionMode, 'ask');
  initial.preferences.actionMode = 'yolo';
  assert.equal(validateWorkspace(JSON.parse(JSON.stringify(initial))).preferences.actionMode, 'yolo');
  initial.preferences.actionMode = 'untrusted';
  assert.equal(validateWorkspace(initial).preferences.actionMode, 'ask');
  delete initial.preferences.actionMode;
  assert.equal(validateWorkspace(initial).preferences.actionMode, 'ask');
});

test('chat mode is present in composer and agents use the same authorization for initial inspection and model calls', () => {
  const chat = source('src/views/Chat.tsx');
  const agent = source('src/engine/agent.ts');
  assert.match(chat, /aria-label="Tool execution mode"/);
  for (const mode of ['ask','auto','yolo']) assert.match(chat, new RegExp(`<MenuItem value="${mode}">`, 'i'));
  assert.match(chat, /<ChangesetReview args=\{approval\?\.args \?\? \{\}\}/);
  assert.match(agent, /await authorize\('inspect_project'/);
  assert.match(agent, /await authorize\(call\.function\.name, args\)/);
  assert.match(agent, /const taskGrants = new Set<TaskGrant>\(\)/);
});
