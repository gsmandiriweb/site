import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z
    .object({
      // Stable identity is intentionally separate from the Markdown filename.
      id: z
        .string()
        .regex(
          /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-hj-km-np-tv-z]{26})$/i,
        ),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string(),
      kicker: z.string().optional(),
      excerpt: z.string().optional(),
      publishedAt: z.coerce.date().optional(),
      // `date` remains readable while existing posts migrate to `publishedAt`.
      date: z.coerce.date().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      aliases: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).optional(),
      image: z.string().optional(),
      // ADR 0011: alt text is required whenever a featured image is set.
      imageAlt: z.string().optional(),
      // `draft` remains readable as a compatibility alias for status: draft.
      draft: z.boolean().optional(),
    })
    .superRefine((data, context) => {
      if (data.image && !data.imageAlt) {
        context.addIssue({
          code: "custom",
          path: ["imageAlt"],
          message: "imageAlt is required when image is set (ADR 0011).",
        });
      }
    }),
});

export const collections = { blog };
