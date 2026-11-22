# AGENTS.md

Working rules for coding agents (and humans) in this repo. `CLAUDE.md` imports this file.

## What this is

Personal portfolio site: Next.js 16 (App Router, React 19, Tailwind 4), built with
OpenNext and served as a Cloudflare Worker (`wrangler.jsonc`).

- `src/app/page.tsx`: home page.
- `src/app/lab/<experiment>/`: experiments. `/lab` and `sitemap.xml` list each subfolder
  with a `page.tsx` automatically, so a new experiment is just a new folder with a page.
  The page list lives in `src/app/lib/site/routes.ts` (tested): fixed pages, explicit
  exclusions (e.g. `/offline`), and the sitemap entries. `/lab/sitemap` explains it on the site.
  The folders are read at build time; the deployed Worker has no file system.
- `src/app/api/push/*`: Web Push API (subscribe, unsubscribe, public key, send).
- `src/app/lib/`: shared code; `lib/server/` is server-only (Cloudflare bindings).
- `src/app/components/`, `src/app/hooks/`: UI pieces and client hooks.
- Import alias: `@/*` → `src/*`.

## Commands

Package manager is pnpm 12 (`pnpm install --frozen-lockfile`). Dependencies allowed to
run install scripts are listed under `allowBuilds` in `pnpm-workspace.yaml`.

| Task                     | Command                                            |
| ------------------------ | -------------------------------------------------- |
| Lint + format check      | `pnpm lint` (fix: `pnpm lint:fix`)                 |
| Typecheck                | `pnpm typecheck` (app + service worker)            |
| Tests                    | `pnpm test` (node:test over `tests/**/*.test.ts`)  |
| Dev server               | `pnpm dev`                                         |
| Regenerate binding types | `pnpm cf:typegen` (after editing `wrangler.jsonc`) |

Run lint, typecheck and tests before every commit. `pnpm build` works locally (dev bindings
are local); the Cloudflare build on the PR is the check for the Worker bundle.

## Deploys

Cloudflare Workers Builds runs on every push:

- **`main`**: `pnpm run deploy` (build, then deploy). Merging to `main` puts it live.
- **Other branches**: `pnpm run upload:preview` (build, then `wrangler preview`). Each branch
  gets a Worker Preview at `<branch>-portfolio.jinjingwu.workers.dev`, behind Cloudflare Access.
  Previews use the bindings in the `previews` block of `wrangler.jsonc`: a preview-only KV, their
  own `TranslateQuota` storage, and the real Workers AI account.

These commands are set in the Cloudflare dashboard (Workers → portfolio → Settings → Builds),
not in the repo. On other branches a green "Workers Builds" check means the build and preview
worked, not that production changed; `pnpm exec wrangler deployments list` shows what is live.

Because the Worker implements a Durable Object, Cloudflare no longer generates per-version
URLs (`pnpm run upload` / `wrangler versions upload`), and a new Durable Object migration can
only be applied by the `main` deploy. A new binding must be added to `previews` too.

## Danger zones

- **Merging to `main` deploys production.** Never merge, and never run `pnpm run deploy`
  or `pnpm run upload`, unless the owner asks in that conversation.
- **Dev uses a local KV.** `pnpm dev` stores `PUSH_SUBSCRIPTIONS` under `.wrangler/state`,
  not in production. Don't add `"remote": true` back to the binding: it would point dev at
  real subscriber data. Local VAPID keys in `.dev.vars` are a dev-only pair.
- **Workers AI is always remote.** The `AI` binding (camera translate) calls the real account
  from `pnpm preview` too, spending the shared daily allowance. Test with a few photos, not
  loops; the translate limits live in `TRANSLATE_LIMITS`.
- **`worker.ts` is the Worker entry.** It wraps OpenNext's generated `.open-next/worker.js` and
  exports the `TranslateQuota` Durable Object. `pnpm dev` can't run Durable Objects, so camera
  translate only works under `pnpm preview` locally. Adding a Durable Object class needs a new
  entry in `migrations` in `wrangler.jsonc`.
- **Secrets** (`VAPID_PRIVATE_KEY`, etc.) live in Cloudflare and in `.dev.vars` locally.
  Never read, print or commit `.dev.vars` or `.env*` files.
- `cloudflare-env.d.ts` is generated; don't edit it by hand.

## Service worker

- One worker for the whole site: `src/sw/sw.ts` (own `tsconfig.json` with the `webworker` lib),
  bundled to `public/sw.js` by `pnpm build:sw`, which `build` and `dev` run first. `public/sw.js`
  is generated and git-ignored; edit the TypeScript. Its decisions live in
  `src/app/lib/pwa/swProtocol.ts` (tested).
- Registered on every page in production builds only (`PwaUpdatePrompt` in the root layout), so
  test it with `pnpm preview`, not `pnpm dev`. The Claude browser pane can't register service
  workers; use real Chrome or Safari.
- A new deploy's worker waits until the user taps Reload in the "new version" prompt (or every
  tab closes). Don't call `skipWaiting()` on install: it would swap code under open pages.
- `public/webPushServiceWorker.js` is a redirect to `/sw.js` for browsers registered before #82.
- **Caching** (`src/app/lib/pwa/cachePolicy.ts`, `strategyFor`): hashed `/_next/static` files
  cache-first, page loads network-first (3 s) falling back to the cached page then `/offline`,
  public assets stale-while-revalidate. APIs, non-GET, other origins and Next RSC fetches are never
  cached. A new route or API needs no change unless it should work offline; if it must never be
  cached, make sure `strategyFor` returns network-only for it (add a test row).
- Page caches and the precache are per version; `jj-static` and `jj-assets` are shared across
  versions on purpose (an old tab still needs its old chunks). Cache sizes live in `CACHE_LIMITS`.
- **Install** (`src/app/manifest.ts`): the navbar shows "Install app" when the browser offers
  `beforeinstallprompt`; iPhone/iPad tabs get a one-time Add to Home Screen hint. The choice is
  `installHint` in `src/app/lib/pwa/installPolicy.ts` (tested). The manifest's install-dialog
  screenshots are in `public/screenshots/`; retake them when the pages they show change a lot.
- **Share target** (`src/app/lib/pwa/shareTarget.ts`): a photo shared to the installed app is a
  POST to `/lab/camera-translate/share`. The worker keeps it in the `jj-share` cache and redirects
  to `/lab/camera-translate?shared=1`, which takes it out and shows it. Any site can post there,
  so the page translates only after a tap (never automatically). With no worker, the route at
  that path redirects with `?shared=unavailable`. Android/Chrome only.
- **App badge** (`appBadge.ts`): a push badges the icon with the number of notifications still
  showing; `AppBadgeClearer` clears it when the app is opened. No-op where unsupported.

## Code style

- Biome formats: tabs, double quotes. Don't hand-format against it.
- Keep decisions (validation, limits, formatting) in pure functions under `src/app/lib/`
  that take values and return values; API routes stay thin: load, call the pure code,
  write. Name limits and magic numbers in one constants object.
- Error handling uses the `try` package (`const [ok, error, value] = t(...)`).
- Early returns over nested `if` blocks.

## Git and PRs

- Branches: `type/<issue>-<slug>` or `type/<slug>` (e.g. `fix/push-rate-limit`).
- PR titles: Conventional Commits, `type(scope): summary (#issue)`.
- Small commits, one idea each; short messages saying what, why and how it was verified.
- Update README.md in the same PR when setup, scripts, layout or the deploy flow change.
- No AI attribution trailers or footers in commits or PRs.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
