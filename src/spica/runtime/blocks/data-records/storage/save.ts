import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "save",
  "version": 1,
  "categoryId": 6,
  "subcategory": "storage",
  "kind": "action",
  "label": "Save record",
  "inputs": "Record values",
  "outputs": "Saved revision or storage error",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "records.write"
  ],
  "tags": [
    "records",
    "database",
    "sqlite",
    "persist",
    "storage"
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
        "description": "Saved revision or storage error"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:save"
  }
});
