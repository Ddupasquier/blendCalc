# app-skeleton

This repository is now a blank SvelteKit starter with Supabase auth plumbing and Vercel adapter configuration.

## What stays in the skeleton

- SvelteKit app structure
- Supabase client/server setup and auth flows
- Vercel adapter + Speed Insights wiring
- Existing test/check/build tooling

## Quick start

```bash
nvm use
npm install
cp .env.example .env
```

Set at least these variables in `.env` for local build/check:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then run:

```bash
npm run dev
```

## Validation commands

```bash
npm test
npm run check
npm run build
```
