# MakeRNB

AI-powered music studio built with Next.js.

**Version:** `v1.1.0`

MakeRNB is a production-oriented music creation platform with a unified Studio workflow, track library, generation callbacks, permission-based features, and subscription billing.

## What This Project Includes

- Prompt-based **Music Generator**
- **Music Extender** for continuing uploaded tracks
- **Music Cover** generation from uploaded audio
- **Mashup** workflow for combining two sources
- **Add Track** workflows (`Vocal` / `Melody`)
- **Vocal Separation** (`separate_vocal`)
- **Split Stem** generation
- **Generate MIDI** from split stem results
- Lyrics generation and synced lyrics panel
- Persona creation flow
- Replace Section editing workflow
- Track library, publish/unpublish, favorites, likes, sharing
- Tier-based permissions and credits

## Studio Feature Map

| Feature | Route | Purpose |
| --- | --- | --- |
| Music Generator | `/music-generator` | Generate from prompt + style |
| Music Extender | `/music-extender` | Continue uploaded audio |
| Music Cover | `/music-cover` | Recreate style from uploaded source |
| Mashup | `/mashup` | Blend two uploaded tracks |
| Add Track | `/add-track` | Add vocal or melody |
| Add Vocal | `/add-vocal` | Generate vocals over instrumental |
| Add Melody | `/add-melody` | Generate instrumental over vocal |

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, Sonner
- **Database:** PostgreSQL (Neon-compatible)
- **Auth:** Supabase Auth
- **Storage:** Cloudflare R2
- **Music APIs:** KIE / Suno API (+ Replicate for selected pipelines)
- **Audio UI:** wavesurfer.js
- **State:** Zustand

## Monorepo Structure

```text
app/                  Next.js app routes + API routes
components/           UI and feature components
features/             Domain feature modules
hooks/                Reusable hooks
lib/                  API clients, DB helpers, permissions, pricing
types/                Shared TypeScript types
scripts/              Utility and maintenance scripts
```

## Prerequisites

- Node.js `18+`
- npm
- PostgreSQL database
- Supabase project
- KIE API key

Optional:

- Cloudflare R2 (for file storage)
- Replicate API token (for related pipelines)
- Creem credentials (billing)

## Local Setup

1. Clone the repository.

```bash
git clone https://github.com/nasirannn/makernb.git
cd makernb
```

2. Install dependencies.

```bash
npm install
```

3. Create env file.

```bash
cp .env.example .env.local
```

4. Fill `.env.local` with required values.

## Environment Variables

Core runtime:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KIE_API_KEY`

Commonly used optional runtime keys:

- `KIE_API_BASE_URL` (default: `https://api.kie.ai`)
- `NEXT_PUBLIC_BASE_URL`
- `INDEXNOW_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

R2 storage:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_DOMAIN`

Replicate:

- `REPLICATE_API_TOKEN`
- `REPLICATE_SPLEETER_VERSION`

Billing (Creem):

- `CREEM_API_KEY`
- `CREEM_WEBHOOK_SECRET`
- `CREEM_API_BASE_URL`
- `CREEM_BILLING_PORTAL_URL`
- `CREEM_PRODUCT_ID_MONTHLY_STARTER`
- `CREEM_PRODUCT_ID_MONTHLY_HOBBY`
- `CREEM_PRODUCT_ID_YEARLY_STARTER`
- `CREEM_PRODUCT_ID_YEARLY_HOBBY`

## Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint

npm run physical-delete:preview
npm run physical-delete:db-only
npm run physical-delete:r2-only
npm run physical-delete:execute
```

## API / Callback Notes

- Music generation, upload, extend, cover, mashup, split stem, and MIDI flows rely on callback-based async processing.
- The app includes callback handlers under `app/api/callbacks/**`.
- Track-level states are persisted in DB tables and surfaced in Studio list UI.
- MIDI results are stored and visualized via the MIDI result dialog flow.

## Permissions and Tiers

Feature access is gated by tier permissions (for example: model access, split stem, MIDI generation, public visibility control, download formats).

Key implementation points:

- Permission checks: `lib/feature-permissions.ts`
- Pricing and feature copy: `lib/pricing-config.ts`, `components/pricing/*`
- Client permission fetch: `app/api/user-permissions/route.ts`

## Deployment

Recommended: **Vercel**

1. Connect repository.
2. Set all required environment variables.
3. Deploy.

Before production deploy:

- Confirm callback URLs are reachable.
- Confirm DB schema is up to date.
- Confirm billing product IDs map to your environment.

## Current Scope and Non-Goals

This repository contains product code and runtime integrations, but does not include:

- Turnkey SQL migration history for all environments
- One-click infra provisioning

Use your own DB migration and secret management workflow in CI/CD.

## Contributing

1. Create a feature branch.
2. Keep changes scoped and lint-clean.
3. Open a PR with concise behavior summary and testing notes.

## Support

If something breaks in a specific flow (generation, callback, permission, billing), include:

- Route / feature name
- Request or task ID
- User ID (if applicable)
- Relevant API response/error logs

That context is usually enough to trace issues quickly.
