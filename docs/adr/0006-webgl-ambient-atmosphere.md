# ADR 0006 — WebGL ambient atmosphere (supersedes ADR-0004/0005 on 3D)

- **Status:** Deprecated (scrapped — the shader background did not land aesthetically; see ADR-0007)
- **Date:** 2025-07-30
- **Context:** ADR-0004 and 0005 attempted a procedurally-modeled BRC exploded assembly (flat drawing, then a materiality-exception render). Both were scrapped as aesthetically unconvincing — wire mesh does not render convincingly in three.js, and no shader rescues a model that doesn't read as the object. The client's standing complaint: the site "looks like someone who sells books, not construction materials." The root cause is not a missing 3D model; it is that the entire Blueprint Field surface is flat paper-and-ink, so a contractor sees a brochure, not material.

## Decision

Add a **WebGL ambient atmosphere canvas** behind the hero content on marketing
pages. Three.js/shaders provide _mood and materiality_ — drifting mesh,
warehouse light, steel-toned depth, particulate — so the hero feels made of the
material, without ever trying to render a recognizable product (the failure mode
of 0004/0005). The **hero is the crafted instance** of this atmosphere. Real
BRC photography continues to do the product proof; the canvas does atmosphere,
not simulation.

**Containment (revised from initial full-bleed plan):** the canvas lives
_inside the hero section_ (absolute, z-index 0), not as a fixed full-page
background. Reason: the Blueprint Field content sections use **opaque paper
surfaces** (`.wrap`, `.section` → `background: var(--paper)`), which would
completely cover a fixed background canvas. The hero is transparent, so the
canvas shows through there — and the hero is where the "not books" impression
is made (first viewport). Below the fold, opaque reading surfaces are correct.
This is more aligned with "hero is the most crafted instance" and avoids a
risky full-site transparency change.

This is **atmosphere, not product modeling** — the explicit lesson from two failed attempts. Shaders are used for what they are good at (noise, light, depth, motion), not what they are not (convincing product geometry).

## Discipline (what keeps this from being a performance/UX disaster)

1. **Behind content, never on top.** The canvas is a fixed background layer; all text/photos/CTAs sit above it with sufficient contrast. The drafting-sheet typography and real photos remain the primary experience.
2. **Cheap to run.** Low particle/element count, simple shaders, capped pixel ratio. Pause the render loop when the canvas is offscreen or the tab is hidden.
3. **`prefers-reduced-motion` → static.** Reduced-motion users get a static frame (or nothing), never motion. The page must be fully usable and beautiful without the canvas.
4. **No product simulation.** The canvas renders abstract material atmosphere only. It does not attempt to model BRC panels, tiang, or any recognizable product. (This is the rule 0004/0005 broke.)
5. **Blueprint Field palette.** The atmosphere uses the system's colors (paper, ink, blueprint-indigo, galvalume steel, signal-orange) — it extends the drafting-sheet world into motion, it does not import a different visual language.

## Considered Options

- **A — Ambient background atmosphere (chosen).** Changes the feel of the whole site; uses shaders for their strengths; never models a product.
- **B — Photo parallax/treatment only.** Safe, high quality, but only affects photo zones — the rest of the page stays "books." May be folded in later as an enhancement, not the foundation.
- **C — Signature hero moment only.** High impact but contained; folded into A as the hero's crafted instance rather than a separate piece.
- **D — Interactive material swatch showcase.** Niche; a tool, not atmosphere. Rejected for this purpose.
- **Procedural product modeling (0004/0005).** Rejected — two failed attempts confirm wire mesh does not render convincingly and it fights the site identity.

## Consequences

- Supersedes ADR-0004 and 0005 (both deprecated). The "materiality exception" idea from 0005 is partially preserved: the atmosphere is the new vehicle for materiality, but as abstract background rather than a contained product render.
- New component (e.g. `Atmosphere.astro` + a client scene module) mounted in `Base.astro` so it appears on all marketing pages. `three` (already installed) is the renderer.
- Performance budget: the canvas must not touch LCP or interactivity. Lazy-init, pause offscreen, respect reduced-motion. If it can't meet the budget on low-end mobile, the fallback is no canvas (the static page), not a degraded one.
- DESIGN.md's Flat Sheet Rule is _not_ suspended (unlike 0005) — the atmosphere is background, not a surface with resting shadows. The drafting-sheet identity stays intact; the canvas extends it.
