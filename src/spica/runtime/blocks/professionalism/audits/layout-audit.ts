import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "layout_audit",
  "version": 1,
  "categoryId": 35,
  "subcategory": "audits",
  "kind": "action",
  "label": "Audit keyboard focus and overflow",
  "inputs": "Rendered screen",
  "outputs": "Measured issues by block ID",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "keyboard",
    "focus",
    "overflow",
    "quality"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Rendered screen"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Measured issues by block ID"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:layout_audit"
  }
});
