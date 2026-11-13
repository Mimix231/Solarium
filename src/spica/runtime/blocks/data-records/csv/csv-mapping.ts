import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "csv_mapping",
  "version": 1,
  "categoryId": 6,
  "subcategory": "csv",
  "kind": "action",
  "label": "Map CSV columns",
  "inputs": "CSV headers and distinct destination fields",
  "outputs": "Typed staged rows for review",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "files.open"
  ],
  "tags": [
    "csv",
    "header",
    "columns",
    "inventory",
    "import"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "CSV headers and distinct destination fields"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Typed staged rows for review"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:csv_mapping"
  }
});
