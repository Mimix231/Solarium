import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "record_choice",
  "version": 1,
  "categoryId": 2,
  "subcategory": "fields",
  "kind": "screen",
  "label": "Bound choice field",
  "inputs": "Allowed options and default",
  "outputs": "Selected record value",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "choice",
    "select",
    "enum",
    "field",
    "inventory"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Allowed options and default"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Selected record value"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:record_choice"
  }
});
