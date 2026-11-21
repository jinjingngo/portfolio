# AGENTS.md

Working rules for coding agents (and humans) in this repo. `CLAUDE.md` imports this file.

## What this is

Personal portfolio site: Next.js 16 (App Router, React 19, Tailwind 4), built with
OpenNext and served as a Cloudflare Worker (`wrangler.jsonc`).

- `src/app/page.tsx`: home page.
- `src/app/lab/<experiment>/`: experiments. `/lab` lists each subfolder automatically,
  so a new experiment is just a new folder with a `page.tsx`.
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
| Typecheck                | `pnpm exec tsc --noEmit`                           |
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
