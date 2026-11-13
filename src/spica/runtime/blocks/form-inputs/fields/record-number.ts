import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "record_number",
  "version": 1,
  "categoryId": 2,
  "subcategory": "fields",
  "kind": "screen",
  "label": "Bound numeric field",
  "inputs": "Numeric default and optional min/max",
  "outputs": "Validated numeric record field",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "number",
    "quantity",
    "bound",
    "field",
    "inventory"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Numeric default and optional min/max"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Validated numeric record field"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:record_number"
  }
});
