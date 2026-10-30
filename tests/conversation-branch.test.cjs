const test = require('node:test');
const assert = require('node:assert/strict');
const { forkChatSession } = require('../.test-dist/domain/conversations.js');

function makeSession() {
  return {
    id: 'session-1', title: 'Original conversation', sparkId: 'spark-1',
    modelId: 'gguf-1', mode: 'research', createdAt: '2026-10-09T12:00:00Z',
    updatedAt: '2026-10-09T12:00:00Z', messages: [
      { id: 'm1', role: 'user', content: 'Question', createdAt: '2026-10-09T12:00:00Z' },
      { id: 'm2', role: 'assistant', content: 'Answer', createdAt: '2026-10-09T12:01:00Z' },
      { id: 'm3', role: 'user', content: 'Followup', createdAt: '2026-10-09T12:02:00Z' },
    ],
  };
}

test('branch copies messages through the selected message and retains Spark/model/mode', () => {
  const source = makeSession();
  const branch = forkChatSession(source, 'm2');
  assert.ok(branch);
  assert.notEqual(branch.id, source.id);
  assert.equal(branch.parentSessionId, source.id);
  assert.equal(branch.forkMessageId, 'm2');
  assert.equal(branch.sparkId, source.sparkId);
  assert.equal(branch.modelId, source.modelId);
  assert.equal(branch.mode, source.mode);
  assert.deepEqual(branch.messages.map((m) => m.id), ['m1', 'm2']);
  branch.messages[0].content = 'Changed only in branch';
  assert.equal(source.messages[0].content, 'Question');
  assert.equal(source.messages.length, 3);
});

test('branch rejects nonexistent messages without changing the source', () => {
  const source = makeSession();
  assert.equal(forkChatSession(source, 'missing'), null);
  assert.equal(source.messages.length, 3);
});
