# ADR 0007 — Shader treatment of real photos (curtains.js) + reactive mesh hero (OGL)

- **Status:** Accepted
- **Date:** 2025-07-30
- **Context:** ADRs 0004-0006 attempted procedural 3D product modeling and a background WebGL atmosphere; all were scrapped as aesthetically unconvincing or invisible (the atmosphere rendered behind opaque content). The client's standing brief: the landing page must be "interesting" and "engaging," and products shown on the landing must "feel premium" — not "like someone who sells books." Research surfaced two open-source libraries that solve the problems the prior attempts hit: `curtains.js` (syncs shaders to DOM `<img>` elements — the shader lives _on_ the photo, not behind opaque content) and `OGL` (minimal raw WebGL for a custom hero shader, lighter than three.js).

## Decision

Two distinct shader surfaces, two tools:

1. **curtains.js on the real BRC photos** — the hero specimen and the BRC showcase specimen stage become WebGL planes with two combined effects: (a) scroll-driven distortion/parallax (the specimen feels like a physical object moving in space) and (b) a raking-light highlight on hover (the steel catches light like inspecting a specimen under a moving lamp). The Di Lapangan proof grid and catalog cards stay static — proof grid is intentionally calm ("pinned photographs"), and small/grid images don't read the effect and add cost.

2. **OGL reactive mesh hero piece** — a single full-screen-quad fragment shader in the hero rendering the BRC mesh as a reactive surface: it ripples where the mouse moves, and the mesh lines catch a galvanized metallic sheen. Visibly alive (engaging), on-brand (it's the mesh = the page grid), and construction-material (steel). This is a _foreground reactive element_, not the passive background that failed in ADR-0006.

## Why this works where prior attempts didn't

- **Uses the real photography** — the one asset that genuinely looks like steel. Prior attempts manufactured steel-ness from geometry/shaders alone.
- **Shader lives on the image** (curtains.js) — sidesteps the ADR-0006 bug where a background canvas was hidden behind opaque paper surfaces.
- **Reactive, not passive** — the hero mesh responds to the mouse; the photos respond to scroll/hover. "Interesting/engaging" comes from interaction, not ambient motion.
- **No product modeling** — the lesson from ADRs 0004/0005. Shaders treat existing imagery and render abstract reactive surfaces; they do not attempt to model BRC panels.

## Libraries

- `curtainsjs` (MIT, ~1.8k stars, actively maintained, vanilla JS, sizes planes via CSS) — DOM-to-WebGL plane sync for the photos.
- `ogl` (Unlicense, ~4.6k stars, minimal WebGL framework) — the reactive mesh hero shader.
- `three` was removed (ADR-0006 deprecated); not reintroduced. OGL is lighter and sufficient for a 2D shader.

## Discipline (carried from ADR-0006)

- Lazy-init after first paint; never block LCP.
- `prefers-reduced-motion` → static (no distortion, no ripple; photos render as normal images).
- No-WebGL fallback → curtains.js/OGL render nothing; the real `<img>` elements remain fully visible (curtains.js overlays the image, so the image is the floor).
- Pause offscreen / tab-hidden.
- Blueprint Field palette throughout.

## Consequences

- Two new dependencies (`curtainsjs`, `ogl`). Both MIT/Unlicense, both small.
- New components: an OGL hero mesh shader + a curtains.js photo-treatment module. The hero specimen and showcase specimen stage gain WebGL plane overlays.
- Supersedes ADR-0006 (deprecated). ADRs 0004/0005 remain deprecated (procedural 3D modeling stays rejected).
- The real `<img>` elements stay in the DOM as the accessible, no-JS, reduced-motion floor — curtains.js layers _over_ them, it does not replace them.
