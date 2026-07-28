import { config, fields, collection } from "@keystatic/core";

// Keystatic config — git-backed CMS for the blog.
// Content lives as markdown in src/content/blog (same files Astro reads),
// images upload into src/images/ref (where existing blog images live).
export default config({
  storage: {
    kind: "github",
    // Owner/name of the GitHub repo this site is built from.
    repo: "gsmandiriweb/site",
  },
  collections: {
    blog: collection({
      label: "Blog",
      slugField: "title",
      path: "src/content/blog/*",
      // Frontmatter holds the fields; the markdown body maps to `body`.
      // extension:'md' keeps files as .md so Astro's content loader/render works.
      format: { contentField: "body" },
      schema: {
        title: fields.text({ label: "Judul", validation: { isRequired: true } }),
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
