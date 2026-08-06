# BSM Starwind field subset

These Astro components are a deliberately scoped, manually copied subset of Starwind UI's native field primitives:

- `Input.astro`
- `NativeSelect.astro`
- `Textarea.astro`
- `variants.ts`

They are used by `/penawaran` and preserve native HTML form semantics, IDs, names, browser validation, and the existing RFQ script. The project uses Tailwind CSS v4 utilities without Tailwind preflight, so the existing BSM stylesheet remains authoritative outside these fields.

The Starwind CLI was not used to generate these files because this repository enforces Bun through `devEngines`, while the CLI invokes npm internally. If the integration is expanded later, compare updates against the pinned Starwind package/registry source before copying new primitives, and keep the local BSM token overrides in `src/styles/starwind.css` intact.
