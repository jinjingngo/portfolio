# portfolio

Source of [wujinjing.com](https://wujinjing.com): a personal site with a `/lab` of small
experiments, such as a Web Push demo at `/lab/web-push` and a camera translator at
`/lab/camera-translate`.

Next.js 16 (App Router, React 19, Tailwind CSS 4), built with
[OpenNext](https://opennext.js.org/cloudflare) and served as a Cloudflare Worker. It is also an
installable PWA.

## Getting started

Requirements: Node 22.18 or later, and pnpm 12 (the version is pinned in `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. `pnpm dev:https` serves over HTTPS with a certificate
from a local CA (mkcert) that only this machine trusts. To test push on a phone, run
`pnpm dev:https --hostname <your LAN IP>` so the certificate covers that address, and install
and trust the CA's `rootCA.pem` on the phone. Next prints that folder when it creates the
certificate ("CA Root certificate created in …").

Production builds install a service worker (`src/sw/`): pages you've visited open offline,
others show `/offline`, and a new deploy offers "A new version is available · Reload". Test it
with `pnpm preview` in real Chrome or Safari.

The dev server uses local Cloudflare bindings: push subscriptions live in a local KV under
`.wrangler/state`, never in production.

### Web Push locally

The push demo needs VAPID keys in `.dev.vars` (git-ignored, never commit it). Generate a
dev-only pair with `pnpm exec pushforge vapid`, then fill in:

```
VAPID_PUBLIC_KEY="<base64url public key>"
VAPID_PRIVATE_KEY='<private key as JWK JSON>'
VAPID_SUBJECT="https://wujinjing.com"
```

Use a dev-only key pair, not the production keys. Production keys are Cloudflare secrets.

### Camera translate locally

`/lab/camera-translate` needs `pnpm preview`: its daily cap is a Durable Object defined in
`worker.ts`, which `pnpm dev` doesn't run (the API answers 503 there). Workers AI has no local
mode, so `pnpm preview` calls the real Cloudflare account (sign in with
`pnpm exec wrangler login`) and spends the same daily free allowance as production (10,000
neurons, about 40 per photo). Local runs keep their
own daily count, so they spend the shared allowance without counting toward production's cap.

## Scripts

| Command                       | What it does                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                    | Dev server                                                         |
| `pnpm lint` / `pnpm lint:fix` | Biome lint and format check / fix                                  |
| `pnpm typecheck`              | Typecheck the app and the service worker                           |
| `pnpm test`                   | Unit tests (`node:test`, `tests/**/*.test.ts`)                     |
| `pnpm build`                  | Next.js production build                                           |
| `pnpm preview`                | OpenNext build, served locally in the Workers runtime              |
| `pnpm upload:preview`         | Build and create/update this branch's Worker Preview on Cloudflare |
| `pnpm cf:typegen`             | Regenerate `cloudflare-env.d.ts` after editing `wrangler.jsonc`    |

## Project layout

- `src/app/page.tsx`: home page
- `src/app/lab/<experiment>/`: experiments; `/lab` lists each folder automatically
- `src/app/api/push/*`: Web Push API (public key, subscribe, unsubscribe, send)
- `src/app/api/translate/image`: camera translate API (Workers AI)
- `src/app/lib/`: shared code (pure decisions are tested); `lib/server/` for Cloudflare bindings
- `tests/`: unit tests
- `src/sw/`: the service worker (TypeScript), built to `public/sw.js` by `pnpm build:sw`
- `public/`: static files

## Deploys

Cloudflare Workers Builds builds every push. Merging to `main` deploys production
(`pnpm run deploy`); other branches get a Worker Preview (`pnpm run upload:preview`). See
[AGENTS.md](AGENTS.md) for details and for the working rules used in this repo.
