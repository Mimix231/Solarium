const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const root = path.join(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('removed Activity rail cannot trigger the old unstable Zustand selector loop', () => {
  const chat = source('src/views/Chat.tsx');
  assert.doesNotMatch(chat, /function ActivityPanel\(/);
  assert.doesNotMatch(chat, /<ActivityPanel\s*\/?/);
  assert.doesNotMatch(chat, /useSolarium\(\(s\) => \(s\.workspace\.workEvents \?\? \[\]\)\.filter\(/);
  assert.match(chat, /<VisualActionCard /);
});

test('Tool permission history remains persisted while conversation navigation stays safe', () => {
  const workspace = defaultWorkspace();
  const sessionId = 'session-42';
  workspace.activeSessionId = sessionId;
  workspace.preferences.showActivity = true;
  workspace.workEvents = [
    { id: 'event-1', sessionId, kind: 'tool_call', runId: 'run-1', sequence: 1,
      at: new Date().toISOString(), tool: 'inspect_project', status: 'completed', text: 'Inspected folder' },
    { id: 'event-2', sessionId: 'other-session', kind: 'tool_result', runId: 'run-2', sequence: 2,
      at: new Date().toISOString(), tool: 'read_project_file', status: 'completed', text: 'Read a file' },
  ];
  const stored = validateWorkspace(workspace);
  assert.equal(stored.preferences.showActivity, true);
  assert.equal(stored.workEvents.filter((event) => event.sessionId === sessionId).length, 1);
  // The panel can be visible after app restart; the fix must not depend on clearing history.
  assert.equal(stored.workEvents.length, 2);
});

test('Render errors show a recoverable diagnostic instead of a blank app window', () => {
  const boundary = source('src/components/RenderErrorBoundary.tsx');
  const main = source('src/main.tsx');
  assert.match(main, /<RenderErrorBoundary key=\{view\}/);
  assert.match(boundary, /static getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /Close activity and retry/);
  assert.match(boundary, /Return Home/);
  assert.match(main, /updatePreferences\(\{ showActivity: false \}\)/);
});
