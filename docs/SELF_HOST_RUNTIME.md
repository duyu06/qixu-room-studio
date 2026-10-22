# Runtime dependency vendoring (GOAL P1)
This repo serves a static site from `site/` on Render without a Node runtime during page visits. `npm run vendor` produces `site/vendor/` using fixed package versions. The GitHub Action pushes generated assets only to the isolated goal branch, then manual PR review can switch HTML import maps from third-party CDN references to same-origin files.

Packages: `three@0.186.1`, `suncalc@2.1.1`, `three-gpu-pathtracer@0.0.27`. Generated license notices are retained under `site/vendor/licenses/`. The action is intentionally not configured to push to `main`.

This branch now uses import maps pointing to local vendor files for both ordinary Three.js and WebGPU path tracing. It dynamically imports SunCalc from a local ESM file. The browser acceptance suite denies external JS downloads to verify startup without CDN.
