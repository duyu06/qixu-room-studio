# Qixu Unified Studio — One working surface

Canonical editor: / (redirects once to /studio.html) and /studio.html, includes projects, floor plan, furniture, materials,
airflow/solar analysis, and WebGPU lighting in the SAME browser page and canvas.

Legacy URL compatibility: /index.html (historical separate-format floorplan),
/showcase.html (optional shareable investor introduction), /photoreal.html (direct
lighting-only view). Their code is not duplicated into Studio.

Authoritative project: studio-model.js, with projectStorageKey() separating my
project from demo projects. Existing Studio geometry and opening data drive all views.

Reusable modules:
- studio-analysis.js: existing V8 PressureFlow2D + studio-render-bridge; no bespoke solver.
- studio-unified.js: one 112-line controller for project cards, airflow/solar and
  lazily embedded photoreal.html?embed=1; unload iframe on exit to free GPU.
- Existing native Studio CSS/DOM and Three.js, not a second React/Vue app.

Limits: WebGPU light tracing remains an on-demand same-origin iframe inside the
same workspace as an interim adapter (no browser navigation), not yet a fully
refactored native renderer. Legacy feng-shui demo has a different project schema
and still needs explicit migration. Not full Coohom equivalence.
