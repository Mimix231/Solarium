import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "status",
  "version": 1,
  "categoryId": 3,
  "subcategory": "feedback",
  "kind": "action",
  "label": "Show status",
  "inputs": "Text",
  "outputs": "Accessible status",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "message",
    "feedback",
    "accessibility"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Text"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Accessible status"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:status"
  }
});
