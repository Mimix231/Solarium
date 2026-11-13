import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "style_token",
  "version": 1,
  "categoryId": 29,
  "subcategory": "tokens",
  "kind": "screen",
  "label": "Shared theme token",
  "inputs": "Compatible app theme token",
  "outputs": "Resolved block appearance",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "theme",
    "style",
    "token"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Compatible app theme token"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Resolved block appearance"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:style_token"
  }
});
