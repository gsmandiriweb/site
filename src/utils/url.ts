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

// Default WhatsApp number (mobile = WhatsApp). Single source of truth so the
// deep-link target never drifts across surfaces.
export const WA_NUMBER = "6281249343303";

// General pre-filled quote request used wherever no sharper context exists
// (header, footer, float, hero/close CTAs).
const WA_GENERAL =
  "Halo BSM, saya tertarik dengan material bangunan dari CV Bangun Sarana Makmur. " +
  "Mohon info harga pabrik, ketersediaan stok, dan pengiriman ke proyek saya. Terima kasih.";

// Build a WhatsApp deep-link with an optional pre-filled message so a buyer
// lands on a ready-to-send quote request instead of a blank chat. Pass a
// context string (category, product, article) to slash inquiry friction.
export function waLink(text: string = WA_GENERAL, number: string = WA_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
