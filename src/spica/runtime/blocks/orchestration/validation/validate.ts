import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "validate",
  "version": 1,
  "categoryId": 4,
  "subcategory": "validation",
  "kind": "action",
  "label": "Validate fields",
  "inputs": "Record values",
  "outputs": "Valid record or field error",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "required",
    "fields",
    "form",
    "input",
    "errors"
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
        "description": "Valid record or field error"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:validate"
  }
});
