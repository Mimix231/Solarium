import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "review",
  "version": 1,
  "categoryId": 6,
  "subcategory": "review",
  "kind": "screen",
  "label": "CSV and record review",
  "inputs": "Collection and selected file",
  "outputs": "Editable rows, validation issues, import and export",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "files.open"
  ],
  "tags": [
    "csv",
    "validate",
    "correct",
    "import",
    "export",
    "records",
    "table"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Collection and selected file"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Editable rows, validation issues, import and export"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:review"
  }
});
