// Base-aware URL helper.
// On GitHub Pages a project site is served under /<repo>/, so every root-absolute
// asset/route link must be prefixed with `base`. `u()` does that in one place,
// which also makes it trivial to retarget the site to another host later.
export const base = ((import.meta.env.BASE_URL as string) || "/").replace(/\/+$/, "") || "";

export function u(path: string): string {
  // Leave external URLs, protocol-relative, and mailto:/tel: untouched.
  if (/^(https?:)?\/\//.test(path) || /^(mailto:|tel:)/.test(path)) return path;
  const p = path.startsWith("/") ? path : "/" + path;
  return base + p;
}

// Default WhatsApp number (mobile = WhatsApp). The final RFQ handoff keeps
// this value in one place so the destination never drifts across the flow.
export const WA_NUMBER = "6281249343303";

// Build the canonical quote-form URL. Product/category pages use this instead
// of opening WhatsApp directly, so every inquiry passes through the same
// validated request flow. Unknown or omitted values are handled by the form.
export function quoteLink(
  options: {
    category?: string;
    product?: string;
    notes?: string;
    intent?: "project" | "home";
  } = {},
): string {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.product) params.set("product", options.product);
  if (options.notes) params.set("notes", options.notes);
  if (options.intent) params.set("intent", options.intent);
  const query = params.toString();
  return u(`/penawaran${query ? `?${query}` : ""}`);
}
