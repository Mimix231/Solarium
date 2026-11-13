import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "when",
  "version": 1,
  "categoryId": 4,
  "subcategory": "conditions",
  "kind": "action",
  "label": "Conditional action",
  "inputs": "Field comparison",
  "outputs": "Execute or skip an action",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "condition",
    "compare",
    "branch"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Field comparison"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Execute or skip an action"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:when"
  }
});
