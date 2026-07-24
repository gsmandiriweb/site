import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    excerpt: z.string().optional(),
    date: z.coerce.date(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { blog };
