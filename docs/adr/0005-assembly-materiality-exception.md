# ADR 0005 — Exploded assembly: materiality exception (supersedes ADR-0004)

- **Status:** Deprecated (superseded by ADR-0006 — procedural product modeling abandoned as aesthetically unconvincing)
- **Date:** 2025-07-30
- **Context:** ADR-0004 built the BRC exploded assembly as a flat, no-orbit, monochrome drafting drawing — consistent with the Blueprint Field system (DESIGN.md Flat Sheet Rule, anti-luxury-showroom). On review it reads as cheap: primitive geometry (a box + cylinder grid) with bare `MeshStandardMaterial` and no environment reflections, no shadows, no ground. More fundamentally, the client said the site "looks like someone who sells books, not construction materials" — the all-drawing, no-material identity leaves contractors with no sense of steel. A pure-linework 3D (the on-brand fix) would still be a drawing, which is the complaint.

## Decision

Treat the BRC exploded assembly as the **one contained materiality exception** on the site: the single surface where real steel is shown, against the flat drafting-sheet backdrop everywhere else. The contrast (paper everywhere → real steel here) is the point — the assembly becomes a specimen brought onto the drafting sheet, not a showroom.

This **suspends** the following DESIGN.md / ADR-0004 rules **for the assembly component only**:

- The Flat Sheet Rule (shadows/contact now allowed, as state of a real object).
- The anti-luxury-showroom rule (a reflective metal render is now the goal).
- ADR-0004 discipline #1 "no orbit-by-default" is relaxed: a slow authored drift may be permitted, but drag-rotate stays.

Everything else on the site stays strictly Blueprint Field. The exception is spatially contained to `/pagar-brc#rakitan`.

## What "materiality" requires (the fix)

The cheapness was ~80% geometry + lighting, ~20% material. So:

1. **Real welded-mesh geometry, not a box.** The panel is built from actual wires crossing in a grid — light passes through the mesh. This is the single biggest fix; a shader can't rescue a box pretending to be mesh.
2. **Galvanized-steel material with an environment map.** Metal needs something to reflect; a bare lit standard material reads flat-grey. Use a generated/HDRI environment (or a procedural gradient cube) for the spangled galvanized sheen.
3. **Soft shadows + a ground contact.** Parts sit on a shadow-catching ground plane so there is scale and weight.
4. **Better lighting** — a 3-point rig with a warm key + cool fill, not two flat directionals.
5. **Authored explode, not a linear slide** — parts separate with a small rotation/arc, not pure translation.
6. **Labels integrated into the 3D** (sprites or CSS2D anchored to geometry), not floating HTML over a flat scene — the leader-line idea stays, but it must read as part of the object.

Shaders are **in scope** where they materially help: a galvanized-spangle fragment shader (procedural noise → iridescent steel) and/or a tone-mapping pass for the render to feel photographic rather than "three.js tutorial." They are NOT the foundation — geometry and lighting come first; shaders polish the material.

## Considered Options

- **A — Fix it as a better 3D drawing (linework/wireframe).** On-brand, but still "books" — the client's exact complaint. Rejected.
- **B — One contained materiality exception (chosen).** Gives the steel hit the client asked for; the contrast with the flat site is itself premium; keeps the rest of the system intact.
- **C — Loosen the whole system toward materiality.** Overcorrection; loses the distinctive drafting identity. Rejected.

## Consequences

- Supersedes ADR-0004's anti-showroom discipline for this component. ADR-0004's other points (procedural geometry from specs, lazy-load, `prefers-reduced-motion` fallback, scoped to BRC) remain in force.
- DESIGN.md's Flat/anti-showroom rules still govern every other surface; this ADR is the narrow, documented exception, not a precedent.
- Cost rises: real mesh geometry + env map + shadows + (optional) custom shader. Performance stays bounded by the existing lazy-load + reduced-motion guards.
- If the materiality exception proves the client's appetite for more steel elsewhere, a future ADR can extend it — but deliberately, one surface at a time, not by silently loosening the system.
