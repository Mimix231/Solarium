const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const fruits = ['peach','cherry','lime','blueberry','tangerine','kiwi','strawberry'];

test('fruit themes each load their own material stylesheet and expose scoped theme tokens', () => {
  const entry = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src/themes/registry.ts'), 'utf8');
  for (const theme of fruits) {
    assert.match(entry, new RegExp(`themes/${theme}/${theme}\\.css`));
    assert.match(registry, new RegExp(`id: '${theme}'`));
    const source = fs.readFileSync(path.join(root, `src/themes/${theme}/${theme}.css`), 'utf8');
    assert.match(source, new RegExp(`data-theme='${theme}'`));
    assert.match(source, /--app-decoration/);
    assert.match(source, /--surface-strong/);
  }
});

test('anime editor includes independent drawing layers and undo/redo plus safe imported preset validation', () => {
  const svg = fs.readFileSync(path.join(root, 'src/components/AnimeAvatar.tsx'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'src/components/AvatarStudio.tsx'), 'utf8');
  for (const layer of ['hairstyle','bangs','eyeShape','outfit','accessory','skin']) assert.match(editor, new RegExp(layer));
  assert.match(svg, /viewBox="0 0 200 200"/);
  assert.match(editor, /setUndo/); assert.match(editor, /setRedo/);
  assert.match(editor, /validateSpark/); assert.match(editor, /solarium-anime-avatar-v1/);
});
