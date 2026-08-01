# ADR 0004 — BRC exploded-assembly: three.js with procedural geometry (supersedes ADR-0001 on 3D)

- **Status:** Deprecated (superseded by ADR-0006 — procedural product modeling abandoned as aesthetically unconvincing)
- **Date:** 2025-07-29
- **Context:** ADR-0001 rejected three.js for the BRC showcase as fighting the flat drafting-sheet system and adding ~600KB to a mobile WhatsApp funnel. ADR-0002 reaffirmed that rejection for _showroom-style_ 3D (orbit/spin a product). This ADR narrows an exception: an **exploded-assembly diagram** — an instructional drafting artifact, not a product viewer — for the BRC flagship only.

## Decision

Add a three.js exploded-assembly view to the BRC showcase (`/pagar-brc`). It is **Option B: procedural geometry built from the real authored specs**, not a loaded external 3D model.

- **Procedural geometry from `catalog.ts`.** The panel is a box at 240×150 cm, wire at ∅6 mm, baseplate at 150×150 mm — dimensions drawn from the same `ShowcaseItem.specs` that feed the photo callouts. The 3D view is the spec sheet in three dimensions; one source of truth.
- **No external model asset.** No CAD/STEP file exists in the project and the client (a distributor, not a fabricator) is unlikely to supply one. Parts are built from three.js primitives at real dimensions rather than hand-modeled in Blender.

### Discipline rules (what keeps this on-brand — violating any reverts to "no 3D")

1. **No orbit-by-default.** The assembly sits at a fixed isometric drafting angle. The user may drag to rotate a _limited_ range; it never auto-spins. Auto-spin = showroom, which ADR-0001/0002 reject.
2. **Leader-line labels + dimensions on every part**, drawn from the same `specs` data as the photo callouts. Reads as an exploded engineering drawing, not a product viewer.
3. **Lazy-loaded.** three.js + the scene load only when the assembly section scrolls into view, not on page load. The BRC page's LCP (hero specimen photo) stays fast.
4. **`prefers-reduced-motion`** → static isometric frame (rendered screenshot of the scene), no drag, no explode animation.
5. **Scoped to BRC only.** Flagship treatment for the one product with real authored dimensions. Not a pattern every product gets.

### Interaction model

**Interaction-driven, not scroll-driven.** A "Lihat rakitan / Lihat komponen" toggle animates the parts apart on click and back on toggle-off. The page is calm at rest (static isometric drawing) until the user engages — honoring "everything else is calm." Chosen over scroll-driven (ScrollTrigger) because scroll-tied 3D risks gimmickry and mobile jank, and a toggle makes the explode a purposeful act.

## Considered Options

- **A — three.js with a real 3D model (rejected).** Requires a CAD/STEP asset that doesn't exist and the client likely can't supply; hand-modeling accurate parts in Blender is real cost for one diagram.
- **B — three.js with procedural geometry (chosen).** No asset pipeline; dimensions honest by construction (same data as callouts); lighter than a loaded model.
- **C — SVG/CSS 2D exploded diagram (rejected as primary, viable fallback).** Cheapest, zero dependency, perfectly on-brand, but 2D flattens the assembly axis that 3D communicates. Remains the fallback if B's cost or the three.js bundle proves unacceptable.

## Consequences

- `three` added as a dependency (tree-shaken, ~150KB gzipped). Lazy-loaded behind scroll + `prefers-reduced-motion` guard, so it does not touch initial page load or LCP.
- New BRC-only section/component (e.g. `BrcAssembly.astro` + a client module). The scene-geometry code couples to `brcShowcase.items[].specs` for dimensions.
- **Supersedes ADR-0001's 3D rejection** for this narrow case only. ADR-0001's broader stance (no showroom 3D, no 3D as a default product treatment) still stands.
- If the procedural geometry can't be made to read clearly as the real product, fall back to Option C (SVG) rather than shipping a misleading 3D shape — honesty over flash.
