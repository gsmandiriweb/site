import { config, fields, collection } from "@keystatic/core";
import { createElement } from "react";

// Keystatic config — git-backed CMS for the blog.
// Content lives as markdown in src/content/blog (same files Astro reads),
// images upload into src/images/ref (where existing blog images live).
export default config({
  storage: {
    kind: "github",
    // Owner/name of the GitHub repo this site is built from.
    repo: "gsmandiriweb/site",
  },
  // Branding for the Keystatic admin UI (/keystatic). The admin UI is a fixed
  // app (no theme or UI-library override), so the supported lever for making
  // it feel on-brand is the logo mark + name shown in its header.
  ui: {
    brand: {
      name: "Bangun Sarana Makmur",
      mark: () =>
        createElement("img", {
          src: "/logo.png",
          alt: "BSM",
          height: 30,
          style: { borderRadius: "4px" },
        }),
    },
  },
  collections: {
    blog: collection({
      label: "Blog",
      slugField: "slug",
      path: "src/content/blog/*",
      // Frontmatter holds the fields; the markdown body maps to `body`.
      // extension:'md' keeps files as .md so Astro's content loader/render works.
      // `slug` is the slugField (drives the filename, NOT written to frontmatter);
      // `title` is a normal field so it's always serialized into frontmatter
      // (Astro's blog schema requires it). Using `title` as the slugField made
      // Keystatic skip writing it, which broke the build.
      format: { contentField: "body" },
      schema: {
        title: fields.text({ label: "Judul", validation: { isRequired: true } }),
        slug: fields.slug({ name: { label: "Slug" } }),
        kicker: fields.text({ label: "Kicker" }),
        date: fields.date({ label: "Tanggal" }),
        image: fields.image({
          label: "Gambar",
          directory: "src/images/ref",
          publicPath: "/src/images/ref",
        }),
        excerpt: fields.text({ label: "Ringkasan", multiline: true }),
        draft: fields.checkbox({ label: "Draft" }),
        body: fields.markdoc({ label: "Isi Artikel", extension: "md" }),
      },
    }),
  },
});
