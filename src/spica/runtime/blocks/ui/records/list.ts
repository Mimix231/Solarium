import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "list",
  "version": 1,
  "categoryId": 34,
  "subcategory": "records",
  "kind": "screen",
  "label": "Record list",
  "inputs": "Collection",
  "outputs": "Record selection",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "records",
    "browse",
    "filter",
    "search",
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
        "description": "Record selection"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:list"
  }
});
