import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "layout_split",
  "version": 1,
  "categoryId": 31,
  "subcategory": "responsive",
  "kind": "screen",
  "label": "Responsive split layout",
  "inputs": "Review and record panels",
  "outputs": "Side-by-side panels that stack on narrow screens",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "columns",
    "responsive",
    "layout",
    "split"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Review and record panels"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Side-by-side panels that stack on narrow screens"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:layout_split"
  }
});
