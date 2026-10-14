# Routio

A personal, multi-category goal-tracking app. Routio turns big goals into a clear destination (a number to reach or a milestone list to clear), with optional small daily or weekly routines underneath, all shown on one dashboard.

**Live demo:** https://rennjezreelrodriguez.github.io/Routio/

> Built for BSCS 2103 — Application Development & Emerging Technologies (MVP Documentation Worksheet, Week 6).

## Problem

People working toward important goals (fitness, savings, career, personal growth) either juggle several single-purpose apps that don't talk to each other, or use all-in-one tools like Notion that take too much setup. Big goals also feel intimidating without a way to see the small steps that lead to them, so people quietly stop tracking.

## Target user

Students and working people juggling multiple personal goals (health, finances, career, habits) who want one lightweight place to see progress across all of them.

## Top 3 features

1. **Goal creation** with measurable (numeric) or milestone (checkpoint) destinations.
2. **Routines / habits** attachable to a goal, with streak tracking.
3. **Unified dashboard** with progress bars, category filters, and search across all goals.

## MVP roadmap

| Increment | Scope | Weeks |
|---|---|---|
| 1 | Goal creation (measurable + milestone), dashboard with progress bars, category tagging | 1–2 |
| 2 | Routines layer with streaks; search and category filter | 3–4 |
| 3 | Completion celebrations, export/backup, reminders, PWA install polish | 5–6 |

**Status:** Increments 1 and 2 are implemented, along with JSON export/import backup and PWA install support. Completion celebrations and reminders are not built yet.

**Success metric:** percentage of users who log at least one progress update on a goal 30 days after creating it.

## Tech stack

React 18 · Vite · framer-motion · vite-plugin-pwa. All data is stored locally in the browser (`localStorage`); there is no backend. Use **Backup JSON Data** in the menu to export your goals.

## Run locally

```bash
npm ci
npm run dev      # development server
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`. In the repository go to **Settings → Pages → Source** and choose **GitHub Actions**. The Vite `base` path in `vite.config.js` and the paths in `public/manifest.json` must match the repository name (`/Routio/`).
