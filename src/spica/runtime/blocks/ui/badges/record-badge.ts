import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "record_badge",
  "version": 1,
  "categoryId": 34,
  "subcategory": "badges",
  "kind": "screen",
  "label": "Computed status badge",
  "inputs": "Typed comparison and labels",
  "outputs": "Status badge for each record",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "badge",
    "comparison",
    "status",
    "inventory"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Typed comparison and labels"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Status badge for each record"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:record_badge"
  }
});
