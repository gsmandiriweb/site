# ADR 0002 — Premium direction: sharpen Blueprint Field, reject showroom gloss & fabricated metrics

- **Status:** Accepted
- **Date:** 2025-07-29
- **Context:** Request to make the site "more engaging / premium" with animations, selection, filter, search, and possibly 3D, citing two references: the client's other live site `jualpagarbrc.co.id` (a generic WordPress distributor template) and a prototype at `bsm-website.vercel.app` (B2B "Kelas Pro" positioning with a live volume/tonnage calculator, container-fill %, fabrication lead times, and claims like "250+ Proyek B2B" / "100% SNI").

## Decision

Pursue premium through **execution polish on the existing Blueprint Field identity** (direction A), plus **one carefully-scoped honest borrow** from the prototype (direction C): a quote configurator that ends in a pre-filled WhatsApp message. Explicitly reject direction B (adopting the prototype's B2B positioning and metrics wholesale).

Concretely:

- **Premium = precision & craft, not gloss.** Invest in smoother selection transitions, a real cross-catalog filter/search layer, refined micro-interactions, and better specimen-photography treatment — all within the drafting-sheet system already defined in `DESIGN.md`.
- **3D is rejected (again).** ADR-0001 already rejected three.js for fighting the flat drafting-sheet system and adding ~600KB to a mobile-first WhatsApp funnel. That stands. "Premium" here is not "spin the product."
- **No fabricated metrics.** The prototype's "15+ tahun", "250+ proyek", "100% SNI", tonnage formulas, and fabrication lead times are **not** client-confirmed and are forbidden by PRODUCT.md principle #4 ("never fake precision pricing or invent discounts/specs") and the Absences list (no testimonials, no case-study metrics, no pricing data provided). They will not appear unless the client supplies real figures.
- **The one borrow — a quote configurator — must be honest.** It collects the buyer's own inputs (category, product, dimensions, quantity, project location) and composes a WhatsApp RFQ. It computes **no** price, **no** tonnage, **no** stock claim. Output is a message, never a number.

## Considered Options

- **A — Sharpen Blueprint Field (chosen).** The system is already an authored, defensible premium position: engineering precision over showroom gloss, correct for a factory-price distributor whose proof is real photography + real specs.
- **B — Adopt the Vercel prototype wholesale (rejected).** A positioning pivot to "Kelas Pro" B2B that requires real data the client has not supplied; shipping it would fabricate claims and violate the honesty rules that are the site's founding constraint.
- **C — Blend (partially adopted).** Keep Blueprint Field as the visual world; borrow only interactions that can be built honestly. The quote configurator qualifies; the metrics dashboard does not.

## Consequences

- All "premium" work is scoped as polish + new interaction layers on top of the existing design system, not a redesign. `DESIGN.md` named rules (Flat Sheet, Orange-Is-a-Button, Mesh Grid) remain in force.
- A quote configurator becomes a new surface to design (data shape, UX, WhatsApp composition). It is a _collector of buyer intent_, not a calculator of BSM facts.
- Any future request to add experience/project-count/SNI/tonnage claims is blocked until the client confirms real numbers — this ADR is the reference for that refusal.
- Supersedes nothing in ADR-0001; reinforces its 3D rejection.
