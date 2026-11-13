import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "navigate",
  "version": 1,
  "categoryId": 3,
  "subcategory": "routing",
  "kind": "action",
  "label": "Open screen",
  "inputs": "Screen ID",
  "outputs": "Active screen",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "screen",
    "route",
    "navigation"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Screen ID"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Active screen"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:navigate"
  }
});
