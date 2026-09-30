# Latvia Weather

Hourly weather forecast for locations across Latvia, powered by [LVĢMC](https://videscentrs.lvgmc.lv/) data.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the forecast.

### Data freshness

Forecasts, location points, warnings, and alarm polygons are refreshed every 15
minutes. Upstream responses are held in process memory for that window on top of
the Next.js data cache, so a warm instance answers repeat requests without
calling LVĢMC again, and requests that miss at the same moment share a single
upstream call. When upstream fails, the last successful response is served for
up to six hours and flagged as stale in the UI. The window is defined once in
`src/lib/weather/cache.ts`.

### Weather assistant

The chat assistant uses Vercel AI Gateway. For local development, either add an
AI Gateway key to `.env.local`:

```bash
AI_GATEWAY_API_KEY=...
```

or refresh Vercel OIDC credentials and run through Vercel:

```bash
vercel env pull
vercel dev
```

OIDC tokens expire after 12 hours, so refresh them if the assistant reports an
expired local `VERCEL_OIDC_TOKEN`.

Assistant usage is rate limited to 10 messages per anonymous user per hour and
30 messages per IP per hour. In production, configure Upstash Redis or Vercel KV
REST variables so limits are shared across serverless instances:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The equivalent `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are also
supported. Without Redis/KV, local development falls back to an in-memory limit.

## Deploy

Deployed on [Vercel](https://vercel.com). Production URL: [latvia-weather.com](https://latvia-weather.com/)

## MCP

This app exposes a public [Model Context Protocol](https://modelcontextprotocol.io/) server for AI clients.

**Endpoint:** `https://latvia-weather.com/api/mcp`

### Tools

| Tool | Description | Example input |
| --- | --- | --- |
| `list_locations` | All forecast locations with current temperature | _(none)_ |
| `search_location` | Find locations by city or region name | `{ "query": "Rīga" }` |
| `get_forecast` | Hourly forecast for a location (`punkts` ID) | `{ "punkts": "P269" }` |

Forecast responses use ISO 8601 date strings for `fetchedAt` and each hourly `time`.

### Cursor

Add to **Cursor Settings → MCP**:

```json
{
  "mcpServers": {
    "latvia-weather": {
      "url": "https://latvia-weather.com/api/mcp"
    }
  }
}
```

### Other MCP clients

Clients that only support stdio can bridge via [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "latvia-weather": {
      "command": "npx",
      "args": ["mcp-remote", "https://latvia-weather.com/api/mcp"]
    }
  }
}
```

### Local testing

```bash
npm run dev
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```
