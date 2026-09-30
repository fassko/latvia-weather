import { listSocialBriefSchedule } from "./social-brief-schedule";

/**
 * Copy-paste prompt for an AI / human building the Raspberry Pi n8n workflow.
 * Also served from GET /api/social/daily-brief?prompt=1
 */
export function getN8nDailyBriefWorkflowPrompt(options?: {
  baseUrl?: string;
}): string {
  const baseUrl = (options?.baseUrl ?? "https://latvia-weather.com").replace(/\/$/, "");
  const schedule = listSocialBriefSchedule();
  const slotsJson = JSON.stringify(schedule.slots, null, 2);

  return `# Build n8n workflow: Latvia Weather daily HyperFrames social posts

## Goal
On a Raspberry Pi running n8n, automate daily animated weather videos for Latvian cities using the latvia-weather.com social brief API, HyperFrames CLI rendering, and social publishing (Instagram, TikTok, Facebook, X).

## Architecture
- **Data API (Vercel):** ${baseUrl}/api/social/daily-brief
- **Orchestration (Pi):** n8n
- **Render (Pi):** HyperFrames CLI against a local template \`latvia-weather-daily-brief\`
- **Publish:** social nodes or HTTP APIs; captions come from the API

Do NOT scrape LVĢMC from n8n. Always pull payloads from the API.

## Auth
If env \`SOCIAL_BRIEF_SECRET\` is set on the site, every payload request must send:
\`Authorization: Bearer <SOCIAL_BRIEF_SECRET>\`
(or header \`x-social-brief-secret\`).

Schedule catalog and this prompt stay public:
- GET ${baseUrl}/api/social/daily-brief?schedule=1
- GET ${baseUrl}/api/social/daily-brief?prompt=1

## Schedule slots (Europe/Riga)
Use **three separate Cron triggers** (or one Cron + IF by day), matching these slots:

\`\`\`json
${slotsJson}
\`\`\`

### Slot → API calls
1. **weekday_morning** (Mon–Fri 06:45)
   \`${baseUrl}/api/social/daily-brief?slot=weekday_morning&locale=lv\`
2. **friday_weekend_outlook** (Fri 16:00)
   \`${baseUrl}/api/social/daily-brief?slot=friday_weekend_outlook&locale=lv\`
3. **weekend_morning** (Sat–Sun 09:00)
   \`${baseUrl}/api/social/daily-brief?slot=weekend_morning&locale=lv\`

Each returns:
\`\`\`json
{
  "slot": { "id": "...", "cron": "...", "platforms": ["instagram","tiktok"], ... },
  "locale": "lv",
  "count": 2,
  "payloads": [
    {
      "citySlug": "riga",
      "variables": { "...HyperFrames vars..." },
      "render": { "outputKey": "renders/YYYY-MM-DD/weekday_morning/riga-lv.mp4", "width": 1080, "height": 1920 },
      "captions": { "instagram": "...", "tiktok": "...", "facebook": "...", "x": "..." },
      "publish": { "selected": ["instagram","tiktok"], "interesting": false, "rainChance": 12 }
    }
  ],
  "n8n": {
    "timezone": "Europe/Riga",
    "templateCompositionId": "latvia-weather-daily-brief",
    "renderRoot": "~/renders",
    "variablesFileName": "variables.json"
  }
}
\`\`\`

For HyperFrames batch CLI you can also request:
\`${baseUrl}/api/social/daily-brief?slot=weekday_morning&locale=lv&format=jsonl\`

## n8n node graph (build exactly this)
1. **Cron** ×3 (timezone Europe/Riga) with the crons above
2. **Set** node: \`slot\` from the cron that fired
3. **HTTP Request** GET daily-brief for that slot (JSON). On 401, fail loudly (secret misconfigured)
4. **Split Out** / **Item Lists** → one item per \`payloads[]\`
5. **Write Binary/File**: save \`variables\` JSON to \`{{renderRoot}}/{{dayKey}}/{{slotId}}/{{citySlug}}-variables.json\`
6. **Execute Command**:
   \`hyperframes render $TEMPLATE_DIR --variables-file <variables.json> --strict-variables --width 1080 --height 1920 --output <absolute path from render.outputKey under renderRoot>\`
7. **IF** \`publish.interesting\` OR platform in \`publish.selected\`
8. **Publish**
   - Always: Instagram Reel + TikTok using \`captions.instagram\` / \`captions.tiktok\` and the MP4
   - If selected includes facebook/x: post those captions too
9. **Telegram/Slack** success summary: city, slot, platforms, output path
10. **Error Trigger** workflow: notify on HTTP/render/publish failure; do not retry social posts blindly more than once

## Rules
- Start with **Rīga only** by temporarily filtering \`payloads\` where \`citySlug === "riga"\` until posting is stable
- One composition template; only variables change
- Keep MP4s on disk under dated folders for manual re-post
- Never block the whole batch on one city failure — continue, then alert
- Prefer Latvian locale (\`locale=lv\`) for local socials
- UTM links are already inside captions/deepLink — do not rewrite URLs

## Acceptance checks
- Weekday 06:45 run creates MP4 for Rīga (and Liepāja when enabled)
- Friday 16:00 run uses slot \`friday_weekend_outlook\` and weekend-oriented captions
- Weekend 09:00 run uses slot \`weekend_morning\`
- Rainy days expand \`publish.selected\` to include Facebook/X
- Failed HyperFrames render sends an alert and skips publish for that city

## Out of scope
- Building the HyperFrames HTML template (assume it already binds the variable schema from \`?schema=1\`)
- Hosting n8n itself
`;
}
