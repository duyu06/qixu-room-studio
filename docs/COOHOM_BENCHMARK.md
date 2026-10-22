# Qixu Studio · Coohom-style product benchmark

Target: a distinct Qixu-brand interior design editor implementing the **workflow concepts** of Coohom, not its trademarks, site design assets, copyrighted models, or source code.

Research:
- https://www.coohom.com/helpcenter/floor-plan-design-basics
- https://www.coohom.com/in/helpcenter/4-ways-to-create-a-new-project-in-coohom
- https://www.coohom.com/case/floor-plan-maker

## Stage 1 — implemented in /studio.html
- Left modules: floor plan, furniture, finishes; right editable property inspector.
- 2D vector wall tool with 10cm snapping, dimension labels, select/undo/redo.
- Doors & windows attached to walls; 3D wall solids are actually split around openings.
- Procedural furniture catalog (no licensed third-party models), 2D drag, rotation/measure controls, 3D preview with camera controls.
- Demo plan, empty plan, image underlay, legacy local plan import, JSON import/export and 2D SVG / 3D PNG exports.
- Same-origin, locked Three.js runtime from existing repository.
- Editing project schema qixu-studio v1 stored in localStorage. Existing CFD lab remains under /index.html.

## Important non-claims
- This is **not full Coohom feature parity**. Coohom's large asset library, CAD/DXF/PDF support, AI auto-tracing, ceiling and kitchen construction, cloud rendering, VR panorama, collaboration, pricing, user identity and multi-tenant storage are not implemented in the first-stage editor.
- Tracing over image underlay is manual; layout is not guaranteed to match CAD/BIM or measured walls.
- Furniture geometry is simplified; project data is kept locally, not cloud synchronized. Shadow maps are real-time 3D preview, not certified photometric values.

## Next staged engineering goals
1. 2D wall endpoints editable after creation, corner snapping, robust collision, room polygons and auto-dimension constraints.
2. Improved import: SVG/DXF/PDF pipelines, AI wall detection with confidence/manual editing.
3. Door/window editing with positioning/hinges and daylight using shared openings.
4. GLTF/GLB furniture catalogs, physically based materials, image textures and versioned asset permissions.
5. Render pipeline: GPU path tracing with supported device matrix, camera compositions and job gallery.
6. Accounts, sharing, revisions, GDPR/local privacy, metered rendering, uptime and observability.
