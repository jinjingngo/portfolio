# portfolio

Source of [wujinjing.com](https://wujinjing.com): a personal site with a `/lab` of small
experiments, such as a Web Push demo at `/lab/web-push`.

Next.js 16 (App Router, React 19, Tailwind CSS 4), built with
[OpenNext](https://opennext.js.org/cloudflare) and served as a Cloudflare Worker. It is also an
installable PWA.

## Getting started

Requirements: Node 22.18 or later, and pnpm 12 (the version is pinned in `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. `pnpm dev:https` serves over HTTPS, which some browser APIs need
on other devices.

The dev server uses local Cloudflare bindings: push subscriptions live in a local KV under
`.wrangler/state`, never in production.

### Web Push locally

The push demo needs VAPID keys in `.dev.vars` (git-ignored, never commit it):

```
VAPID_PUBLIC_KEY="<base64url public key>"
VAPID_PRIVATE_KEY='<private key as JWK JSON>'
VAPID_SUBJECT="https://wujinjing.com"
```

Use a dev-only key pair, not the production keys. Production keys are Cloudflare secrets.

## Scripts

| Command                       | What it does                                                    |
| ----------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                    | Dev server                                                      |
| `pnpm lint` / `pnpm lint:fix` | Biome lint and format check / fix                               |
| `pnpm exec tsc --noEmit`      | Typecheck                                                       |
| `pnpm test`                   | Unit tests (`node:test`, `tests/**/*.test.ts`)                  |
| `pnpm build`                  | Next.js production build                                        |
| `pnpm preview`                | OpenNext build, served locally in the Workers runtime           |
| `pnpm cf:typegen`             | Regenerate `cloudflare-env.d.ts` after editing `wrangler.jsonc` |

## Project layout

- `src/app/page.tsx`: home page
- `src/app/lab/<experiment>/`: experiments; `/lab` lists each folder automatically
- `src/app/api/push/*`: Web Push API (public key, subscribe, unsubscribe, send)
- `src/app/lib/`: shared code; pure decisions with tests, `lib/server/` for Cloudflare bindings
- `tests/`: unit tests
- `public/`: static files, including the push service worker

## Deploys

Cloudflare Workers Builds builds every push. Merging to `main` deploys production
(`pnpm run deploy`); other branches upload a preview version (`pnpm run upload`). See
[AGENTS.md](AGENTS.md) for details and for the working rules used in this repo.
