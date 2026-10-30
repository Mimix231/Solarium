const test = require('node:test');
const assert = require('node:assert/strict');
const { rewindChatSession } = require('../.test-dist/domain/conversations.js');

function makeSession() {
  return {
    id: 'session-1', title: 'First question', sparkId: 'echidna', modelId: 'gguf-42',
    projectId: 'project-1', mode: 'work', createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T10:01:00Z',
    messages: [
      { id: 'u1', role: 'user', content: 'First question', attachments: [{ id: 'f1', name: 'code.ts', mime: 'text/plain', kind: 'text', size: 5, text: 'hello' }], createdAt: '2026-10-10T10:00:00Z' },
      { id: 'a1', role: 'assistant', content: 'First reply', createdAt: '2026-10-10T10:00:10Z' },
      { id: 'u2', role: 'user', content: 'Second question', createdAt: '2026-10-10T10:00:20Z' },
      { id: 'a2', role: 'assistant', content: 'Second reply', createdAt: '2026-10-10T10:00:30Z' },
      { id: 'u3', role: 'user', content: 'Third question', createdAt: '2026-10-10T10:00:40Z' },
    ],
  };
}

test('retry keeps the chosen user prompt, removes its reply and every later turn', () => {
  const source = makeSession();
  const result = rewindChatSession(source, 'u2');
  assert.ok(result);
  assert.deepEqual(result.messages.map((m) => m.id), ['u1', 'a1', 'u2']);
  assert.equal(result.messages[2].content, 'Second question');
  assert.equal(result.modelId, source.modelId);
  assert.equal(result.sparkId, source.sparkId);
  assert.equal(result.projectId, source.projectId);
  assert.equal(result.mode, source.mode);
  assert.equal(source.messages.length, 5, 'replaying does not mutate original objects');
});

test('edit updates the selected user message, preserves its attachments and removes obsolete turns', () => {
  const source = makeSession();
  const result = rewindChatSession(source, 'u1', '  Updated first question  ');
  assert.ok(result);
  assert.deepEqual(result.messages.map((m) => m.id), ['u1']);
  assert.equal(result.title, 'Updated first question');
  assert.equal(result.messages[0].content, 'Updated first question');
  assert.deepEqual(result.messages[0].attachments, source.messages[0].attachments);
  result.messages[0].attachments[0].text = 'changed';
  assert.equal(source.messages[0].attachments[0].text, 'hello');
});

test('editing a later user turn preserves title and all prior responses', () => {
  const source = makeSession();
  const result = rewindChatSession(source, 'u2', 'Replacement');
  assert.equal(result.title, source.title);
  assert.deepEqual(result.messages.map((m) => m.id), ['u1', 'a1', 'u2']);
  assert.equal(result.messages[2].content, 'Replacement');
});

test('editing the first message never overwrites a custom conversation title', () => {
  const source = makeSession();
  source.title = 'Custom project label';
  assert.equal(rewindChatSession(source, 'u1', 'Changed first prompt').title, source.title);
});

test('missing IDs, assistant IDs and empty edits cannot change conversation history', () => {
  const source = makeSession();
  assert.equal(rewindChatSession(source, 'missing'), null);
  assert.equal(rewindChatSession(source, 'a1'), null);
  assert.equal(rewindChatSession(source, 'u1', '  \n   '), null);
  assert.equal(source.messages.length, 5);
});

test('chat has copy, edit, retry actions and shares the normal streaming pipeline', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const chat = fs.readFileSync(path.join(__dirname, '../src/views/Chat.tsx'), 'utf8');
  const store = fs.readFileSync(path.join(__dirname, '../src/state/useSolarium.ts'), 'utf8');
  assert.match(chat, /aria-label="Copy user message"/);
  assert.match(chat, /aria-label="Edit user message"/);
  assert.match(chat, /aria-label="Retry user message"/);
  assert.match(chat, /Save & retry/);
  assert.match(chat, /await runAgent\(/);
  assert.match(chat, /current\.rewindUserTurn\(/);
  assert.match(store, /rewindUserTurn: \(id, messageId, editedContent\)/);
});
