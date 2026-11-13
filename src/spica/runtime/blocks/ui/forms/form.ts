import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "form",
  "version": 1,
  "categoryId": 34,
  "subcategory": "forms",
  "kind": "screen",
  "label": "Record form",
  "inputs": "Collection",
  "outputs": "Submit record",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "records",
    "create",
    "edit",
    "fields",
    "collection"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Collection"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Submit record"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:form"
  }
});
