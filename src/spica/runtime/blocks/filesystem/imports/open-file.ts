import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "open_file",
  "version": 1,
  "categoryId": 7,
  "subcategory": "imports",
  "kind": "action",
  "label": "Read chosen file",
  "inputs": "File picker",
  "outputs": "Bytes or text",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "files.open"
  ],
  "tags": [
    "filesystem",
    "file",
    "import",
    "picker"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "File picker"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Bytes or text"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:open_file"
  }
});
