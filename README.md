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


## Visual Learning Cloud

Visual Studio uses a three-tier learning store:

- **IndexedDB**: offline/local outbox and short retention cache.
- **Google Drive**: compressed bulk history under `Visual Learning Cloud/`.
- **Supabase**: server-only searchable indexes, hashes, sync jobs, candidate/release metadata.

The Google OAuth refresh token is encrypted before it is written to Supabase. Client roles have no table access; only the server-side service role is used.

Required production environment variables:

```text
LEARNING_SUPABASE_URL
LEARNING_SUPABASE_SERVICE_ROLE_KEY
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REDIRECT_URI
```

Recommended hardening:

```text
LEARNING_TOKEN_ENCRYPTION_KEY
LEARNING_ADMIN_EMAILS
LEARNING_INGEST_TOKEN
```

After deployment visit `/admin/storage`, connect Google Drive once, and use the connection test. The app provisions all managed folders automatically.
