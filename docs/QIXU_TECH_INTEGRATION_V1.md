# Qixu unified technology integration v1

Status: architecture specification and acceptance gates. Not a claim that every adapter is implemented.

## Product invariants
- Exactly one Studio, one versioned project document, one shared room coordinate system in **meters** (Three.js Y-up; project floor is X/Z).
- 2D remains SVG and CAD editing; 3D is a derived scene. Never write GLTF/IFC renderer instances into project JSON.
- 3D interactive editing stays on the existing Three.js renderer. Expensive path tracing, mesh import, and AI planning are opt-in and asynchronous.
- Fast edit loop: transform changes update the relevant mesh; geometry changes invalidate only necessary assets; scene snapshot hash invalidates high-quality renders.
- Never silently infer load-bearing walls, certification, compliance, dimensions, or BIM semantics.

## Capabilities and boundaries

| Module | Existing entry | Integration adapter | First acceptance gate |
| --- | --- | --- | --- |
| GLB furniture | `studio-procedural-furniture.js`, `studio.js` | `GLTFLoader` with validated static asset manifest and source/license record; convert source units to meters; preserve the bounding-box footprint, rotation, and SKU | Load one local GLB, fit known 1 m object, select/rotate/move, reload project |
| IFC/BIM | none | `web-ifc`/WASM loaded on demand in worker. Parse products, units, placements and GlobalIds; map approved wall/opening/floor semantics through explicit conversion | IFC fixture imports counts, geometry scale and stable IDs correctly; unsupported entities reported, not dropped invisibly |
| DXF/CAD | `studio-dxf.js` | Extend current safe ASCII parser: LINE/LWPOLYLINE today; add ARC, bulge tessellation, layer whitelist, unit handling and bounded entity count; retain source layer metadata | Round-trip mm/m and bulged-polyline fixture within declared precision |
| Spatial acceleration | `studio.js` raycasting, `studio-tour.js` | `three-mesh-bvh` only for high-triangle static meshes; index once on geometry finalization, dispose on removal; continue lightweight AABB for procedural furniture | Same hit selection / walk collisions, documented speedup on large imported model |
| Photo-quality | `photoreal.html`, `three-gpu-pathtracer` dependency | opt-in path tracing mode; version-pinned Three compatibility; capability detection, progressive samples, memory limits, cancel and WebGL/WebGPU backend compatibility; keep real-time fallback | Repeatable image, explicit sample progress/cancel, no main editor blocking |
| Cloud rendering | Render static site today | Separate authenticated GPU-capable worker/service + job queue + object storage; Render may host API/queue but current static-site service does not execute GPU renders | submit/status/cancel/retry/idempotency, signed result URL, retention and cost caps |
| AI layout | `studio-geometry.js` `suggestLayout` | constraint validator -> model suggestion -> collision/room-fit validator -> user approval -> single undoable project transaction | Rejects incompatible suggestions, never changes saved room without approval |
| Walkthrough | `studio-tour.js` | reuse controller; add broadphase collision, door portals, navmesh only for complex rooms; 360 export as an independent share artifact | WASD, door passage, obstacle collision and share-link privacy verified |

## Module interfaces (proposed)
```ts
type AssetReference = {
  assetId: string; type: 'glb'; sha256: string;
  uri: string; license: string; source: string;
  metersPerUnit: number; sizeMeters: [number, number, number];
};
type ImportResult = {projectPatch: object; warnings: string[]; sourceUnits: string;};
type RenderRequest = {
  projectId: string; sceneHash: string; quality: 'preview'|'final';
  camera: object; width: number; height: number; samples: number;
};
type RenderState = 'queued'|'running'|'completed'|'failed'|'cancelled';
```

## Sequenced development (do not activate all packages at boot)
1. **P0 stability**: finish current furniture rotation and 2D/3D state regression, benchmark latency and confirm Render production; no false-green 3D.
2. **P1 visible product quality**: local GLB manifest + `GLTFLoader` lazy loading; size/axis normalization, disposal/caching and selection fallback to procedural object.
3. **P2 CAD/BIM interchange**: DXF arcs/bulges/layers and unit tests; IFC worker adapter with resource caps; preserve source IDs.
4. **P3 larger projects**: BVH on imported meshes and real measured collision benchmarks; do not replace cheap AABB blindly.
5. **P4 final imagery**: opt-in path tracer with progressive sample count and cancel; require user-visible backend capability and perf checks.
6. **P5 commercial services**: secured cloud rendering API, workers, queue, storage, auth, quotas and cleanup; validated AI layout proposals; walk/share features.

## Non-negotiable safety/performance gates
- Supply/lock exact package and WASM versions; track package licenses (notably web-ifc MPL-2.0) and distribute required notices.
- No CDN model downloads from user-supplied untrusted paths; enforce content length, limits, allowlisted paths and safe ZIP handling if introduced.
- Coordinate transformation and scale validation before assigning geometry to rooms. Do not silently rescale IFC/CAD to fit.
- Imported meshes are geometrically untrusted; bound triangle counts, GPU textures, files, import duration and object counts.
- Keep existing stored v1 projects readable and do not mutate original uploads; revisions use schema migrations.
- Render static-site currently serves files only. GPU server rendering is a new paid service requiring explicit budget/security review.
- Every gate requires functional browser screenshot, automation status, regression and the production deploy SHA.

## Compatibility notes
- `web-ifc` official repository is MPL-2.0 and uses WASM; do not imply it is already running.
- `three-mesh-bvh` speeds raycasting for sufficiently complex **static** geometries; rebuilding on every furniture move defeats the gain.
- `three-gpu-pathtracer` public documentation describes distinct WebGL2/WebGPU versions. Confirm the installed 0.0.27 API and Three 0.186.1 compatibility before integration; no backend assumption.
