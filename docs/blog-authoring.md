# Menulis Artikel Blog — Panduan Penulis

How an article gets from an idea to the live site. Two paths, same destination:

1. **Dashboard CMS** (`/admin`) — markdown-first editor, image upload, GitHub PR per revision. Best for frequent edits with review.
2. **Fail langsung di GitHub** — write the Markdown file, push to `main`, the Cloudflare deploy publishes it. No backend, no dashboard needed.

Artikel disimpan sebagai file Markdown di `src/content/blog/<slug>.md`. GitHub adalah sumber kebenaran; situs publik hanyalah hasil build statis.

## Quick start (file-only path)

```bash
# Scaffold a new post (fills in id, slug, date, status)
bun scripts/new-post.mjs "Judul Artikel Baru"          # → status: published
bun scripts/new-post.mjs "Draf Artikel" --draft        # → status: draft (invisible)

# Edit src/content/blog/<slug>.md, then validate before pushing:
bun scripts/check-posts.mjs

# Commit + push to main → auto-deploy → live at /blog/<slug>
```

## Frontmatter contract (setiap file wajib)

```markdown
---
id: "9f8a…" # WAJIB — UUID/nanoID unik, dibuat oleh scaffolder atau CMS. Jangan diketik manual.
slug: judul-artikel # WAJIB — huruf kecil, angka, tanda hubung. HARUS sama dengan nama file.
title: "Judul Artikel" # WAJIB
kicker: "Panduan Material" # opsional — label pendek di listing
excerpt: "Ringkasan 1–2 kalimat." # opsional — tampil di listing
publishedAt: 2026-09-02 # WAJIB untuk artikel published
status: published # published | draft | archived — default (tanpa field) = draft, TIDAK TAMPIL
aliases: [] # slug lama agar link lama tetap jalan (opsional)
image: blog/slug/cover.jpg # opsional — featured image, path relatif src/images/
imageAlt: "Deskripsi gambar" # WAJIB jika image diisi
date: 2026-09-02 # legacy alias publishedAt (boleh dihilangkan)
draft: false # legacy alias status: draft (boleh dihilangkan)
---
```

Aturan yang paling sering menjegal:

- **Tanpa `status: published` artikel tidak muncul di mana pun** — build lolos, halaman tetap tidak ada. Selalu cek output `bun scripts/check-posts.mjs`.
- **Nama file harus sama dengan `slug`.** `Cara Memilih Pagar.md` dengan `slug: cara-memilih-pagar` = gagal build. Gunakan scaffolder; jangan biarkan GitHub memberi nama file dari judul (berisi spasi/huruf kapital).
- **`id` tidak boleh diketik tangan.** Gunakan `bun scripts/new-post.mjs` atau dashboard.
- **Gambar featured (cover):** simpan di `src/images/blog/<slug>/cover.jpg` dan isi `image` + `imageAlt`. Referensi lama dengan nama file saja (mis. `atap-upvc.jpeg`) masih jalan untuk post yang sudah ada.

## Gambar di dalam isi artikel (body images)

Referensi Markdown memakai bentuk `../../images/…` — relatif terhadap file post
(`src/content/blog/<slug>.md`), yang menunjuk ke `src/images/`:

```markdown
![Alt text yang deskriptif](../../images/blog/<slug>/01-foto-tiang.jpg)
```

- File disimpan di `src/images/blog/<slug>/` (satu folder per artikel — kontrak ADR 0011).
- Saat build, gambar otomatis dioptimalkan (astro:assets → `/_astro/*` + `/_image`), sama seperti featured image.
- **Build GAGAL (ImageNotFound) jika referensi body tidak bisa di-resolve** — ini pengaman CI Anda: referensi yang salah tidak akan ter-deploy. `bun scripts/check-posts.mjs` memeriksanya lebih dulu secara lokal — selalu jalankan sebelum push.
- Format yang diterima: JPEG, PNG, WebP. Maks 5 MB, maks 8000 px tepi terpanjang.
- Lewat dashboard: Media → "Upload image to article body" auto-menyisipkan `![alt](../../images/…)` di akhir artikel; pindahkan dengan mode "Markdown source".
- URL eksternal (https://…) juga boleh; hanya referensi lokal yang dipaksa resolve.

## Alur publish

1. **published + push ke main** → workflow `Deploy BSM site` (satu-satunya workflow deploy; fallback GitHub Pages sudah dihapus) → Cloudflare Workers + Assets.
2. Klik gambar/status di dashboard `/admin` hanyalah lapisan bantu; sumber kebenaran tetap file + git history.
3. **Draf** (`status: draft`) tidak muncul di situs; ubah ke `published` lalu push saat siap.

## FAQ

| Gejala                                                              | Penyebab / perbaikan                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Artikel tidak muncul setelah push                                   | Tidak ada `status: published` (default = draft) atau `publishedAt` hilang. |
| Build gagal: "Rename the Markdown file to match its canonical slug" | Nama file ≠ `slug`. Rename file (bukan slug-nya).                          |
| Build gagal: "Duplicate blog route"                                 | Dua file memakai slug/alias yang sama.                                     |
| Build gagal: "Missing image asset"                                  | `image` frontmatter tidak bisa di-resolve di `src/images/`.                |     | Build gagal: `ImageNotFound` untuk referensi body | Path `![…](…)` tidak resolve — pakai bentuk `../../images/blog/<slug>/…` atau URL eksternal. |
| Mau edit tanpa dashboard                                            | Edit file langsung di GitHub (atau clone) — formatnya sama.                |

## Referensi cepat

- Scaffolder: `bun scripts/new-post.mjs "Judul" [--draft]`
- Validator: `bun scripts/check-posts.mjs`
- Skema post: `src/content.config.ts`
- Rules build: `src/utils/blog.ts` (`validateBlogRoutes`)
- Kontrak media: `docs/adr/0011-media-contract.md`
- Deploy: `docs/deploy-runbook.md`
