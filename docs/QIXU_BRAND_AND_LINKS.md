# QIXU official brand and single-source routing

The original user-provided black house/plant/wordmark logo is the official Qixu mark. Assets in site/assets were cropped from that upload and optimized as transparent PNG; they are not regenerated or replaced by a fabricated letter symbol.

- site/assets/qixu-logo-horizontal.png — shared wordmark for four page headers and showcase footer.
- site/assets/qixu-logo-mark.png — favicon.
- site/qixu-brand.css — shared brand sizing and reusable feature-switcher styling.
- site/src/qixu-shell.js — brand and navigation injection for all four entry pages.
- site/src/qixu-routes.js — single source of truth for page URLs and project localStorage keys.
- site/src/studio.js and site/src/photoreal.js both use projectStorageKey(template).
- Legacy photo-based workflow remains in index.html, with its own qixu-blueprint-v6 schema; users explicitly migrate it from Studio via “读取旧版”. Its data is not silently overwritten or misinterpreted as a professional Studio document.

Development principle: keep official logo assets in ONE location, project formats separated and validated, only one 2D/3D metric model for Studio and rendering via studio-render-bridge.js. Do not duplicate CAD engines or add frameworks for a static document header. 
Reliability: prefer existing Three.js, OrbitControls and Render Static Site. Version/license checks before adding third-party dependencies.
