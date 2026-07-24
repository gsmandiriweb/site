<!-- Direction committed via new-work: "Blueprint Field" (assigned index 6/7 by concept-seed, key bsm-bangun-saranamakmur). Carbonize/verify tokens after the first build lands. -->

---

name: Bangun Sarana Makmur — Blueprint Field
description: A structural drafting sheet for a Surabaya building-materials distributor; BRC fencing is the proof, the blueprint grid is the page.
colors:
paper: "#F2EFE6"
paper-deep: "#E7E2D4"
ink: "#15212E"
ink-muted: "#54606B"
blueprint: "#1B3A6B"
blueprint-deep: "#102A50"
steel: "#8FA3B8"
signal: "#E8551E"
signal-deep: "#C8430F"
signal-darker: "#A8360B"
typography:
display:
fontFamily: "'Archivo', 'Arial Narrow', sans-serif"
fontSize: "clamp(2.4rem, 6vw, 4.6rem)"
fontWeight: 800
lineHeight: 0.98
letterSpacing: "-0.02em"
body:
fontFamily: "'Hanken Grotesk', system-ui, sans-serif"
fontSize: "1.0625rem"
fontWeight: 400
lineHeight: 1.6
label:
fontFamily: "'JetBrains Mono', ui-monospace, monospace"
fontSize: "0.75rem"
fontWeight: 500
letterSpacing: "0.12em"
textTransform: "uppercase"
rounded:
sm: "4px"
md: "8px"
lg: "14px"
spacing:
md: "16px"
lg: "32px"
xl: "64px"
components:
button-primary:
backgroundColor: "{colors.signal-deep}" # AA resting fill; bright signal kept as a 2px accent mark only
textColor: "#FCFAF4"
rounded: "{rounded.sm}"
padding: "14px 28px"
button-primary-hover:
backgroundColor: "{colors.signal-darker}"
button-ghost:
backgroundColor: "transparent"
textColor: "{colors.ink}"
rounded: "{rounded.sm}"
padding: "13px 26px"
---

# Design System: Bangun Sarana Makmur — Blueprint Field

## Overview

**Creative North Star: "The Structural Drafting Sheet."**

The site is rendered as a working structural engineering drawing set for CV Bangun Sarana Makmur, a Surabaya distributor of building materials. The ground is warm drafting paper; blueprint-indigo owns whole regions — the hero delivery map, section field-markers, and the header rule — while ink carries all reading text and galvalume steel draws the grid and dividers. Real BRC fencing photography appears as specimen plates, dimensioned like the products they depict. The page grid _is_ the BRC welded-mesh spacing, so structure is never decoration: it is the product.

The world is confident and industrial, never corporate-template and never luxury-showroom. It proves, it does not claim: every product is shown built to spec, and the primary action is a blueprint-stamped WhatsApp quote. BRC fencing leads because it is the richest real photography and the clearest proof BSM can supply the entire catalog.

**Key Characteristics:**

- Drafting-paper ground, blueprint-indigo region color, ink text, safety-orange reserved for CTAs only.
- The mesh grid is the grid; dimension lines, callouts, and title blocks are real components, not ornaments.
- Specimen photography + engineering annotation; monospace carries measurement and coordinate notation.
- One authored motion moment (callouts draw in, delivery routes extend); everything else is calm.

## Colors

Drafting-paper neutrals carry the page; blueprint-indigo is the committed region color; safety-orange appears only as a CTA fill.

### Primary

- **Blueprint Indigo** (#1B3A6B): owns whole regions — hero delivery-network panel, section field-markers, header underline, active nav state. Its region-scale use is the point.
- **Signal Orange** (#E8551E): CTA fill only (WhatsApp quote, primary buttons). Never used as text; paired with near-white #FCFAF4 label. Deepens to #C8430F on hover.

### Neutral

- **Drafting Paper** (#F2EFE6): page ground and card surfaces; warm, not white.
- **Paper Deep** (#E7E2D4): recessed panels, drawing-sheet backgrounds, alternating sections.
- **Ink** (#15212E): all body and headline text; near-black with a blue cast.
- **Ink Muted** (#54606B): secondary copy, captions, dimension annotations (≥4.5:1 on paper).
- **Galvalume Steel** (#8FA3B8): grid lines, dividers, dimension strokes, and hairline rules on paper; the metallic accent that is not a color.

## Typography

**Display Font:** Archivo, expanded (font-stretch 110–125%), weights 700–800 (with Arial Narrow fallback)
**Body Font:** Hanken Grotesk, weights 400–600 (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono, weights 500–700

**Character:** Industrial, drafting-weight display against a quiet humanist body; monospace supplies the measurement voice of a drawing sheet. The pairing is workmanlike, not editorial-serif and not corporate-sans-default.

### Hierarchy

- **Display** (800, clamp(2.4rem, 6vw, 4.6rem), line-height 0.98, tracking -0.02em, expanded): hero headline and section titles only.
- **Headline** (700, clamp(1.5rem, 3vw, 2.2rem), line-height 1.05): product names, block leads.
- **Title** (600, 1.25rem): card titles, sub-blocks.
- **Body** (400, 1.0625rem, line-height 1.6, measure 65–72ch): paragraphs, descriptions.
- **Label** (500, 0.75rem, tracking 0.12em, uppercase, mono): eyebrows, dimension callouts, spec keys, nav.

### Named Rules

**The Mesh Grid Rule.** The base grid is the BRC mesh (≈ equal columns at ~120px on desktop). Every layout aligns to it; never float an element off-grid "for balance."

**The Orange Is a Button Rule.** Safety-orange appears only as a fill behind a label or as a 2px spec mark. It is never body text, never a full section ground.

## Layout

A drafting sheet: max content width ~1200px centered on the paper ground, with a persistent thin blueprint rule under the header. Sections are separated by generous vertical rhythm (≥64px) and a hairline steel divider, not by card stacks. The hero is a full-bleed drawing sheet; inner content uses a 12-column mesh with clear gutters. Mobile linearizes to a single column; the dimensioned hero scales down but keeps its callouts. More space sits above a heading than below it.

## Elevation & Depth

Flat by default — depth comes from tonal layering (paper vs paper-deep) and the ink/steel line work, not from shadows. A single soft, offset shadow is permitted only on the floating WhatsApp action and on a hovered specimen plate, to lift it off the sheet.

### Named Rules

**The Flat Sheet Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (float action, hover lift), never as a resting style.

## Shapes

Corners are gently squared (radius 4–8px on controls, 14px on large specimen plates) — drafting-sheet, not pill, not rounded-card. Borders are 1px ink or steel hairlines; the 1px border under a wide shadow is forbidden (no ghost cards). The signature silhouette is the engineering drawing: a title block in the lower-right corner of hero/specimen figures, dimension lines with arrowheads, and leader-line callouts.

## Components

### Buttons

- **Shape:** squared (4px radius), mono label, uppercase, tracking 0.12em.
- **Primary:** signal-deep fill (WCAG-AA with the near-white label), near-white label, padding 14px 28px; bright signal (#E8551E) is reserved for 2px accent marks (eyebrow tick, READY STOCK, callouts).
- **Hover / Focus:** deepens to signal-darker; focus-visible shows a 2px ink outline offset 2px.
- **Ghost:** transparent, ink text, 1px steel border; used for secondary actions.

### Chips / Spec Tags

- **Style:** paper-deep fill, ink-muted mono label, 1px steel border, 4px radius.
- **State:** a "READY STOCK" tag may carry a 2px signal-orange left mark; otherwise tags are neutral.

### Cards / Specimen Plates

- **Corner Style:** 14px radius on large photo plates; 8px on small tiles.
- **Background:** paper or paper-deep.
- **Shadow Strategy:** flat; lift shadow only on hover.
- **Border:** 1px steel hairline; a title block sits in the lower-right corner.
- **Internal Padding:** 16–24px.

### Inputs / Fields

- **Style:** paper ground, 1px ink border, 8px radius, mono label above.
- **Focus:** border shifts to blueprint-indigo, 2px outline.

### Navigation

- **Style:** paper ground, mono uppercase links, ink text; active/hover underline is a 2px blueprint-indigo rule.
- **Mobile:** collapses to a compact bar; links remain mono, stacked under a toggle.

### Signature Component — The Dimensioned Specimen

A product figure rendered as an engineering drawing: the real photo sits inside a drawing sheet with a corner title block (product · scale · origin SBY), dimension lines with arrowheads along two edges, and leader-line callouts (e.g. `∅6 mm`, `240×150 cm`, `Galvanis`). On reach, dimension lines extend and callouts draw in via stroke animation.

## Do's and Don'ts

### Do:

- **Do** lead with real BRC specimen photography, dimensioned like the product it shows.
- **Do** keep blueprint-indigo at region scale (map panel, section fields, header rule), not as scattered accents.
- **Do** use monospace for every measurement, coordinate, and spec key.
- **Do** drive the visitor to a WhatsApp quote; make the CTA a stamped, obvious action.

### Don't:

- **Don't** use safety-orange as text or as a full section ground — it is a button fill only.
- **Don't** drop the grid for "balanced" off-grid placement; the mesh is the layout law.
- **Don't** rest shadows on flat surfaces; shadows answer state, not resting style.
- **Don't** import a corporate template look, glassmorphism, gradient text, or a luxury-showroom palette — the brief rejects all four.
