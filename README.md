# Logika Financial AI v2 — PWA

Dashboard keuangan AI untuk bisnis menengah Indonesia.

## Stack
- Next.js 14 (App Router) + TypeScript
- Recharts (visualisasi)
- Groq API — llama-3.3-70b-versatile (AI analysis)
- Appwrite Cloud (auth + cloud sync)
- jsPDF + jspdf-autotable (PDF export)
- PapaParse + XLSX (CSV/Excel import)
- next-pwa (installable PWA)

## Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local → isi GROQ_API_KEY minimal
# Appwrite opsional untuk cloud sync
npm run dev
```

## Deploy ke Vercel

```bash
vercel
# Set env vars di Vercel dashboard:
#   GROQ_API_KEY
#   NEXT_PUBLIC_APPWRITE_PROJECT_ID  (kalau pakai cloud sync)
#   NEXT_PUBLIC_APPWRITE_DATABASE_ID
#   NEXT_PUBLIC_APPWRITE_COLLECTION_ID
```

## Setup Appwrite (Cloud Sync)

1. Buat project di https://cloud.appwrite.io (gratis)
2. **Authentication** → Enable Email/Password provider
3. **Databases** → Buat database dengan ID: `financial_db`
4. Buat collection dengan ID: `user_data` dan attributes:
   - `userId`  → String, required, size 36
   - `rawData` → String, required, size 100000
   - `kas`     → Integer, required
5. **Collection Settings** → Permissions: tambahkan role `Users` dengan Read + Create + Update + Delete
6. Copy Project ID ke `.env.local`

## Fitur v2

- ✅ **Export PDF** — laporan A4 branded dengan KPI cards + tabel bulanan + anomali
- ✅ **Auth (Appwrite)** — login/register, data cloud sync otomatis (debounced 2s)
- ✅ **Import CSV/Excel** — drag & drop atau pilih file, preview sebelum konfirmasi, mode replace/append
- ✅ **Template CSV** — download template siap pakai
- ✅ **Nama Perusahaan** — tampil di header dan PDF
- ✅ Dashboard KPI + tren chart + anomali detection
- ✅ Proyeksi 3 skenario (Base / +18% / −18%)
- ✅ AI Executive Summary (Groq)
- ✅ Semua data + key persist di localStorage
- ✅ Installable PWA (Android + iOS)

## Struktur

```
app/
├── page.tsx              # Semua UI (Dashboard, Input, AI, Proyeksi, Setting)
├── layout.tsx            # Root layout + PWA meta
├── globals.css
├── lib/
│   ├── data.ts           # Seed data demo + pct()
│   └── appwrite.ts       # Appwrite client + auth + cloud sync helpers
└── api/analyze/
    └── route.ts          # Groq proxy (server-side, key aman)
public/
├── manifest.json
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Format CSV yang Didukung

Kolom wajib (case-insensitive, urutan bebas):
- `bulan` / `month` / `periode`
- `pendapatan` / `revenue` / `income`
- `beban` / `expense` / `biaya` / `cost`

Contoh:
```csv
bulan,pendapatan,beban
Jan'25,335,285
Feb'25,295,305
```
