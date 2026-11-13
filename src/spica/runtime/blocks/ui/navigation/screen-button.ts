import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "screen_button",
  "version": 1,
  "categoryId": 34,
  "subcategory": "navigation",
  "kind": "action",
  "label": "Screen button",
  "inputs": "Label and destination",
  "outputs": "Open a screen on click",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [],
  "tags": [
    "button",
    "navigation",
    "event",
    "screen"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Label and destination"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Open a screen on click"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:screen_button"
  }
});
