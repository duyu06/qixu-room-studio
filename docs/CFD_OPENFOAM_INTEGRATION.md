# Qixu → OpenFOAM: current integration boundary

**Current capability (2026-10-23):** Qixu exports a versioned `qixu-openfoam-input.json` with geometry in meters, wall and furniture solids, door/window opening fractions, pressure assumptions, air density and requested turbulence model. Qixu also exports **binary STL** `qixu-obstacles.stl` from the wall segments **after subtracting openings** and rotated furniture bounding boxes.

**Not yet implemented:** generating the *fluid* volume mesh and patch-labelled inlet/outlet geometry; running `blockMesh`, `snappyHexMesh`, `checkMesh`, a steady or transient incompressible solver; reading residuals; validating turbulence settings, mass conservation or calculating wall-resolved velocity and pressure fields. The static Render web service cannot execute an OpenFOAM binary or launch GPU/CPU simulation jobs.

## Required standalone solver worker
1. Validate `schema=qixu-cfd-job` / `version=1`, coordinates, file integrity and job size. Reject invalid, stale or oversized inputs.
2. Use the selected OpenFOAM distribution/version consistently (OpenFOAM Foundation and OpenCFD syntax differ).
3. Reconstruct a **watertight fluid domain** from room geometry and solid obstacles. Separate inlet/outlet patches aligned to actual door/window openings, including sill, elevation and user-entered open fraction. **Do not** assign pressure to an entire outer face in place of an actual opening.
4. Generate background `blockMesh`, snap/refine solid obstacles using `snappyHexMesh` (or validated mesher), and run `checkMesh`. Failed mesh generation must yield **failed**, never simulated numbers.
5. Define incompressible air properties, boundary conditions, turbulence model (e.g., k–omega SST) and solver limits, validate solver convergence and inlet/outlet mass balance.
6. Produce numerical fields plus provenance: OpenFOAM version, mesh statistics, refinement settings, convergence logs, residuals, case hash, boundary values and sampling units.
7. Provide authenticated APIs: `POST /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, and expiring results. Jobs are queued, running, completed or failed and have resource caps. Only display pressure/velocity contours for **completed and validated** jobs.

## Existing project mapping
- Project X/Z is floor plane; Three.js/OpenFOAM export uses Y vertical.
- Imported GLB objects use their **approximate furniture bounding box**, not a collision-resolved mesh.
- `qixu-openfoam-input.json` is a **request**, not a generated OpenFOAM case.
- `qixu-obstacles.stl` contains solid obstacle surfaces, not a fluid-domain mesh or a solver result.
- Pressure settings are user assumptions; the webpage's reduced-order formula is not a Navier–Stokes CFD solution.

## References
- OpenFOAM snappyHexMesh: https://doc.openfoam.com/2606/tools/pre-processing/mesh/generation/snappyhexmesh/
- OpenFOAM User Guide: https://www.openfoam.com/documentation/user-guide
