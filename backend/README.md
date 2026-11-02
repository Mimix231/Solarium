# Solarium project intelligence

`solarium.py` is the private stdio service supervised by the normal Tauri process. It provides local project indexing, exact source selection, Git status and real language-server requests. It never loads a tensor model or exposes shell/file-write inference RPCs.

Python 3.10+ and the standard library are sufficient. Language servers require their own installed executables. `SOLARIUM_PYTHON` selects an interpreter; `SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER` selects a TypeScript server. Run `npm run test:glitch` for the maintained nine regression tests.

The former Glitch model backend, research panels and experiments were moved out of the production source tree. Their recoverable source checkpoint and per-file manifest are recorded in `docs/info/CODING_CONSOLIDATION_MANIFEST.json`. Its old Torch requirements are not dependencies of this service.
