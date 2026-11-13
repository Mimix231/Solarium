import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "format",
  "version": 1,
  "categoryId": 30,
  "subcategory": "formatting",
  "kind": "action",
  "label": "Format record values",
  "inputs": "Field placeholders and typed record values",
  "outputs": "Formatted text stored in a field",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "format",
    "template",
    "text"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Field placeholders and typed record values"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Formatted text stored in a field"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:format"
  }
});
