import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "game",
  "version": 1,
  "categoryId": 28,
  "subcategory": "scenes",
  "kind": "screen",
  "label": "Shadowium 2D tile scene",
  "inputs": "Typed tile map",
  "outputs": "Playable player, colliders and goal",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "game",
    "shadowium",
    "2d",
    "tiles",
    "keyboard",
    "collision",
    "goal"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Typed tile map"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Playable player, colliders and goal"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:game"
  }
});
