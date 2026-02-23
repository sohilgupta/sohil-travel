# Trip Vault — Setup Guide

A private, password-protected travel document app. Built with Next.js 16, Supabase, and a glass UI. Deploys to Vercel in minutes.

---

## Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name (e.g. `trip-vault`), region closest to you, and a database password
3. Wait ~2 minutes for it to spin up

### Create the database tables

In your Supabase project → **SQL Editor** → paste and run the contents of `supabase/schema.sql`

### Create the storage bucket

1. Go to **Storage** → **New Bucket**
2. Name: `travel-documents`
3. Keep it **Private** (do NOT enable public access)
4. Click **Create**

### Get your API keys

Go to **Settings → API** and copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
APP_PASSWORD=your_password_here
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 3 — Upload Your PDFs

Run the upload script once, pointing it at your documents folder:

```bash
node scripts/upload.mjs --folder "/path/to/your/trip/documents"
```

This will:
- Scan all PDFs recursively
- Parse text and extract metadata (dates, flight numbers, booking refs, etc.)
- Auto-categorize each document
- Upload PDFs to Supabase private storage
- Store structured metadata in the database
- Build your trip summary (dates, passengers, destinations, etc.)

**Example output:**
```
📁 Scanning: /Users/you/trip-docs

Found 12 PDF(s)

📄 Processing: 11Apr_VA147_MEL-ZQN.pdf
   ✅ FLIGHTS | 2026-04-11 | MEL → ZQN (VA147)

📄 Processing: 12 Apr | Milford Sound.pdf
   ✅ ACTIVITIES | 2026-04-12 | Milford Sound Flight and Boat Cruise

✅ Done! 12/12 documents uploaded.
   Trip: DEL → AKL
   Dates: 2026-04-01 → 2026-04-21 (21 days)
   Passengers: Sohil Gupta, Rachna Gupta
```

---

## Step 4 — Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → enter your password → done.

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI (if not already)
npm i -g vercel

# Deploy
vercel
```

Or push to GitHub and connect the repo to [vercel.com](https://vercel.com).

### Set environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** → add all 5 variables from your `.env.local`.

**Important:** Update `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL:
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Redeploy after adding env vars

```bash
vercel --prod
```

---

## App Structure

| Page | URL | Description |
|------|-----|-------------|
| Unlock | `/unlock` | Password gate (auto-detects trip name & dates) |
| Dashboard | `/dashboard` | Hero card + document category tiles |
| Timeline | `/timeline` | Day-by-day trip chronology |
| Documents | `/documents` | Searchable/filterable document explorer |

---

## Add to iPhone Home Screen

1. Open the app in Safari
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. It launches full-screen like a native app

---

## Re-uploading / Updating Documents

The upload script uses `upsert` — just run it again to add new PDFs or update existing ones:

```bash
node scripts/upload.mjs --folder "/path/to/documents"
```

---

## Troubleshooting

**"Document not found" error** — Check that the file was uploaded to the `travel-documents` bucket in Supabase Storage.

**PDFs not categorized correctly** — The script infers category from filename and text content. Rename the file to include keywords like `flight`, `hotel`, `rental`, or `activity`.

**Metadata missing** — The parser uses pattern matching. For best results, ensure PDFs contain extractable text (not just scanned images).

**Build fails on Vercel** — Ensure all 5 environment variables are set, including `NEXT_PUBLIC_APP_URL`.
