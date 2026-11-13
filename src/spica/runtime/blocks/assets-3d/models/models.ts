import { defineSpicaBlock } from '../../defineBlock';

/** Legacy schema-1 implementation is retained by the existing Program runtime. */
export default defineSpicaBlock({
  "id": "models",
  "version": 1,
  "categoryId": 13,
  "subcategory": "models",
  "kind": "screen",
  "label": "STL library",
  "inputs": "Selected STL file",
  "outputs": "Mesh and record",
  "targets": [
    "desktop",
    "web"
  ],
  "permissions": [
    "files.open"
  ],
  "tags": [
    "stl",
    "3d",
    "mesh",
    "model",
    "preview",
    "library"
  ],
  "maturity": "prototype",
  "ports": {
    "inputs": [
      {
        "id": "input",
        "type": "legacy-descriptor",
        "description": "Selected STL file"
      }
    ],
    "outputs": [
      {
        "id": "output",
        "type": "legacy-descriptor",
        "description": "Mesh and record"
      }
    ]
  },
  "dependencies": [],
  "implementation": {
    "kind": "program-v1-adapter",
    "ref": "program:models"
  }
});
