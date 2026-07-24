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
