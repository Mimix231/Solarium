import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "export_file",
  "version": 1,
  "categoryId": 7,
  "subcategory": "exports",
  "kind": "action",
  "label": "Save export",
  "inputs": "Records",
  "outputs": "CSV or JSON file",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "files.export"
  ],
  "tags": [
    "filesystem",
    "file",
    "download",
    "export"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Records"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "CSV or JSON file"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:export_file"
  }
});
