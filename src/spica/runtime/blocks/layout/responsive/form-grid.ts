import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "form_grid",
  "version": 1,
  "categoryId": 31,
  "subcategory": "responsive",
  "kind": "screen",
  "label": "Responsive form grid",
  "inputs": "Bound fields",
  "outputs": "Two-column form that stacks on narrow screens",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "form",
    "columns",
    "responsive",
    "layout"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Bound fields"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Two-column form that stacks on narrow screens"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:form_grid"
  }
});
