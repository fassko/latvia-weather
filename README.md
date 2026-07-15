# Latvia Weather

Hourly weather forecast for locations across Latvia, powered by [LVĢMC](https://videscentrs.lvgmc.lv/) data.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the forecast.

## Deploy

Deployed on [Vercel](https://vercel.com). Production URL: [latvia-weather.vercel.app](https://latvia-weather.vercel.app)

## MCP

This app exposes a public [Model Context Protocol](https://modelcontextprotocol.io/) server for AI clients.

**Endpoint:** `https://latvia-weather.vercel.app/api/mcp`

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
      "url": "https://latvia-weather.vercel.app/api/mcp"
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
      "args": ["mcp-remote", "https://latvia-weather.vercel.app/api/mcp"]
    }
  }
}
```

### Local testing

```bash
npm run dev
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```
