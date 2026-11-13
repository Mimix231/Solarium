import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "table",
  "version": 1,
  "categoryId": 34,
  "subcategory": "tables",
  "kind": "screen",
  "label": "Bound record table",
  "inputs": "Collection, columns, query state and optional comparison",
  "outputs": "Paged sorted records and computed badges",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "inventory",
    "records",
    "table",
    "sort",
    "filter"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Collection, columns, query state and optional comparison"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Paged sorted records and computed badges"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:table"
  }
});
