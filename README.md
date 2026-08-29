# TalentOS — AI HR Suite

A personal, browser-based HR toolkit built with React + Vite + Tailwind. All data lives in your
browser (localStorage); the only network calls go to Groq's free Llama/GPT-OSS API.

## Modules

1. **CV Shortlisting** — paste or upload a merged CVs `.txt` (onefileapp.com format auto-detected)
   plus a JD (paste, PDF or Word). Two-pass AI screening → ranked top-N table
   (Rank, CV name, Candidate, Title, Org, Experience, Qualifications, Email, Phone, Why consider).
   Export CSV / copy table.
2. **JD Generator** — upload your company JD format (.docx parsed locally) once; the AI mirrors its
   exact structure for any new Position / Division / Level. Download Word (.doc), PDF, Markdown,
   plain text — or Copy for Word.
3. **Recruitment Tracker** — inline-editable pipeline + Onboarded sheet (rows move automatically on
   onboarding), KPIs and per-division status chart, CSV import/export.

## Setup

```bash
npm install
npm run dev       # local development
npm run build     # production build → dist/
node scripts/make-zip.mjs   # bundle all source files into talentos-project.zip
```

## Free API key

Settings → paste a key from https://console.groq.com/keys → Test connection.
Default model: `openai/gpt-oss-120b` (best on free keys). Fallback: `openai/gpt-oss-20b`.

## Publish free (static site)

- **Netlify Drop** — drag the `dist/` folder onto https://app.netlify.com/drop
- **Cloudflare Pages** — Pages → Upload assets → drag `dist/`
- **Vercel / Netlify via GitHub** — push this repo, connect it; build command `npm run build`,
  output directory `dist`.

## Project map

```
index.html            entry shell (fonts, title)
src/App.tsx           shell: sidebar, header, module routing
src/index.css         design system (Tailwind v4 tokens, motion, print/md styles)
src/lib/groq.ts       Groq client (free-tier retries, gpt-oss handling, JSON extraction)
src/lib/cv.ts         merged-CV splitter (onefileapp headers, custom separators)
src/lib/docx.ts       .docx → structured text (in-browser ZIP/XML parser)
src/lib/pdf.ts        PDF → text (pdf.js, lazy-loaded)
src/lib/download.ts   Word/PDF/CSV/TXT exports, clipboard, in-frame fallbacks
src/lib/demo.ts       sample CVs, sample JDs, tracker seed data
src/lib/types.ts      shared types + persistence keys
src/lib/store.ts      localStorage state hook
src/components/       icons (inline SVG), UI kit + toasts/modals, settings drawer
src/modules/          Shortlist.tsx · JDGenerator.tsx · Tracker.tsx
scripts/make-zip.mjs  bundles the project into talentos-project.zip
```
