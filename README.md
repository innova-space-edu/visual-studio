# Visual Engine Studio

Standalone laboratory for the Innova Visual platform.

Studio intentionally remains separate from EDUAI until the rendering platform is approved.

## Integrated repositories

- `visual-design-skills`: routing, domain knowledge and deterministic Scene compilation
- `visual-engine`: Scene Graph, renderers, document model and diagnostics
- `visual-assets`: semantic/parametric local assets
- `visual-studio`: testing, inspection, persistence and export

## Current capabilities

- prompt -> VisualBrief -> VisualScene without an image API
- Visual DSL input
- direct VisualScene JSON input/editing
- SVG preview
- MathJax 4 server refinement
- PNG 2x export through resvg
- quality metrics
- self-hosted CanvasKit/Skia WASM probe
- Three WebGPU capability probe
- IndexedDB scene persistence
- local quality-feedback dataset and JSON export
- remote image URLs blocked by the render API

## Local

```bash
npm install
npm run dev
```

CanvasKit's WASM file is copied to `public/wasm` during installation, so Studio does not require a CDN.

Intended host: `studio.visual.innova-space-edu.cl`.
