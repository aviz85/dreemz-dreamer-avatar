# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dreemizer** — AI portrait-to-dream-vision web app. Users upload/capture a portrait, describe a dream, and get an AI-edited image via fal.ai.

## Commands

```bash
npm run dev          # Start client (Vite :5173) + server (Node :3001) concurrently
npm run dev:client   # Vite dev server only
npm run dev:server   # Node.js backend only
npm run build        # TypeScript + Vite production build → /dist
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Architecture

**Frontend:** Single React 19 component (`src/App.tsx`) with Vite + TypeScript.

**Backend (dual):**
- `server.js` — Local dev Node.js server on :3001 (synchronous fal.subscribe)
- `api/generate.ts` + `api/status.ts` — Vercel Edge Functions (async queue + polling)

Vite proxies `/api/*` to `:3001` in dev. In production, Vercel handles API routes directly.

**Image generation flow:**
1. Client POSTs base64 image + dream text to `/api/generate`
2. For SeedDream model: prompt enhanced via OpenRouter GPT-4o before sending to fal.ai
3. For other models: prompt built from template with `{{DREAM}}` placeholder
4. fal.ai queue returns `requestId` immediately
5. Client polls `/api/status` every 5s until completed/failed

**Models** (default: `seedream-v45-edit` → `fal-ai/bytedance/seedream/v4.5/edit`):
- SeedDream v4.5 Edit — $0.03/image, LLM-enhanced prompts
- FLUX 2 Edit — $0.024/image
- Nano Banana Pro — $0.15/image

## Environment Variables

Required in `.env.local` (local) or Vercel dashboard (production):
- `FAL_KEY` — fal.ai API key
- `OPENROUTER_API_KEY` — OpenRouter key for prompt enhancement (optional, falls back to basic prompt)

## Deployment

Deployed to Vercel. Push to `main` triggers auto-deploy. `vercel.json` rewrites `/api/*` routes.

## Design System

CSS variables in `src/index.css`: `--dreemz-pink`, `--dreemz-cyan`, `--dreemz-yellow`, `--dreemz-dark`. Font: Poppins.
