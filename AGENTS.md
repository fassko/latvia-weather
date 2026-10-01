<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Node.js 24 is required (`package.json` engines). Login shells can resolve `node` to an older binary at `/exec-daemon/node` because that directory is ahead of nvm on `PATH`. Select Node 24 before install, lint, test, or the dev server:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
export PATH="$(dirname "$(nvm which 24)"):$PATH"
```

- Dependencies: `npm ci` (lockfile is `package-lock.json`).
- Dev server: `npm run dev` → http://localhost:3000. The app always prefixes locales, so the home forecast is http://localhost:3000/en (Latvian: `/lv`). Default location is Rīga (`P269`).
- Live forecast data is fetched from `https://videscentrs.lvgmc.lv` when a page or `/api/weather` is requested. `/api/locations` returns the station list with current temperatures.
- CI checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- The chat assistant reads `AI_GATEWAY_API_KEY` from `.env.local`. Forecast pages and the map work without it. Assistant rate limits stay in memory unless Upstash Redis or Vercel KV REST variables are set. See the README.
