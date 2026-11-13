import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "set",
  "version": 1,
  "categoryId": 5,
  "subcategory": "records",
  "kind": "action",
  "label": "Set field",
  "inputs": "Record values",
  "outputs": "Record values",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "field",
    "value",
    "state",
    "update"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Record values"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Record values"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:set"
  }
});
