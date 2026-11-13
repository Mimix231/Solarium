import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "record_query",
  "version": 1,
  "categoryId": 6,
  "subcategory": "queries",
  "kind": "action",
  "label": "Query records",
  "inputs": "Search text, sort, typed predicate and page offset",
  "outputs": "Matching records and more flag",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "search",
    "sort",
    "filter",
    "pagination",
    "inventory"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Search text, sort, typed predicate and page offset"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Matching records and more flag"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:record_query"
  }
});
