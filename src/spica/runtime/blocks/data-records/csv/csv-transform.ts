import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "csv_transform",
  "version": 1,
  "categoryId": 6,
  "subcategory": "csv",
  "kind": "action",
  "label": "Custom CSV transform",
  "inputs": "CSV cells",
  "outputs": "CSV cells",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "custom.transform"
  ],
  "tags": [
    "csv",
    "transform",
    "data",
    "table"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "CSV cells"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "CSV cells"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:csv_transform"
  }
});
