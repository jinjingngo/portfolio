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

Package manager is pnpm (lockfile v9). If `pnpm` is not installed:
`npx -y pnpm@10 install --frozen-lockfile`.

| Task | Command |
| --- | --- |
| Lint + format check | `npx biome check` (fix: `npm run lint:fix`) |
| Typecheck | `npx tsc --noEmit` |
| Dev server | `npm run dev` |
| Regenerate binding types | `npm run cf:typegen` (after editing `wrangler.jsonc`) |

Run lint and typecheck before every commit. `next build` needs Cloudflare credentials
(wrangler remote proxy), so it usually fails locally; verify builds on the Cloudflare
preview URL of the PR instead.

## Danger zones

- **Merging to `main` deploys production.** Never merge, and never run `npm run deploy`
  or `npm run upload`, unless the owner asks in that conversation.
- **The dev server uses the production KV.** `PUSH_SUBSCRIPTIONS` is bound with
  `"remote": true`, so local writes and deletes hit real subscriber data.
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
- No AI attribution trailers or footers in commits or PRs.
