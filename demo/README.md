# Demo Video Package

Automated demo walkthrough of Traumabomen using Playwright. Produces a screen
recording (video), 17 numbered screenshots, and a timed voiceover script.

## Prerequisites

- Docker Compose services running (`docker compose up` from project root)
- Node.js 18+ with npx available
- Chromium installed for Playwright (see below)

## Quick Start

```bash
# From project root, ensure services are running
docker compose up -d

# Install Playwright browser (first time only)
cd demo
npx playwright install chromium

# Run the demo
npx playwright test demo.spec.ts --config playwright.config.ts
```

## Output

After a successful run:

| Output | Location |
|--------|----------|
| Video recording (.webm) | `demo/test-results/` |
| Screenshots (17 PNGs) | `demo/screenshots/` |
| Screenshot tour with captions | `demo/screenshots/tour.md` |
| Voiceover script (~3 min) | `demo/voiceover-script.md` |

## Converting Video

The Playwright recording is in WebM format. Convert to MP4 with ffmpeg:

```bash
ffmpeg -i test-results/demo-Traumabomen-demo-walkthrough/video.webm \
  -c:v libx264 -crf 23 -preset medium \
  -c:a aac -b:a 128k \
  demo-recording.mp4
```

## Generating Voiceover Audio

Use any text-to-speech tool with `voiceover-script.md` as the source.
The `[PAUSE Xs]` markers indicate natural pauses between sections.

Example with macOS `say`:

```bash
# Strip markdown formatting and generate speech
sed 's/\*\*//g; s/\[PAUSE [0-9]*s\]//g; /^#/d; /^---/d; /^$/d' voiceover-script.md \
  | say -o voiceover.aiff -v Samantha
```

Example with ElevenLabs or similar cloud TTS: upload the script text directly
and use the `[PAUSE]` markers to insert silence in your editing software.

## Combining Video and Audio

```bash
ffmpeg -i demo-recording.mp4 -i voiceover.aiff \
  -c:v copy -c:a aac -b:a 128k \
  -shortest \
  demo-final.mp4
```

## Configuration

Environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend URL |
| `E2E_API_URL` | `http://localhost:8000` | API URL |

## Demo Flow

The script performs a full walkthrough in 14 scenes (~3 minutes):

1. Landing page
2. Registration with password strength feedback
3. Empty tree list with welcome card
4. Demo tree creation (Whitfield family)
5. Canvas exploration (pan, zoom)
6. Person detail panel (Dorothy Whitfield)
7. Adding a new person (Emma Whitfield)
8. Creating a relationship
9. Timeline view
10. Patterns view
11. Journal
12. Insights
13. Theme switching (light, watercolor if available)
14. Logout, re-login, and data persistence verification

## Troubleshooting

**Browser not installed:** Run `npx playwright install chromium`.

**Services not running:** Ensure `docker compose up` is running and the API
responds at `http://localhost:8000/api/health`.

**Test reset fails:** The API needs `ENABLE_TEST_RESET=true` in its environment.
This is the default in `docker-compose.yml` for local development.

**Watercolor theme not shown:** The watercolor theme requires a feature flag to
be enabled by an admin. The demo gracefully handles this by taking the screenshot
regardless of which theme is active.
