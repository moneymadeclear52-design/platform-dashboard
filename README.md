# Platform Dashboard — Mission Control

A deliberately lightweight ops console for the AI content platform: workflow
run history with an NLE-style step timeline, LLM cost analytics per model,
live API job status, and platform health.

**Stack:** React 18 · TypeScript (strict) · Tailwind v4 · Vite. No state
library, no chart library — the data shapes don't need them (see Design notes).

## Run

Backend first (from content-core):
```bash
pip install -e ".[api]"
uvicorn content_core.api.app:app --port 8000
```
Then:
```bash
npm install
npm run dev            # http://localhost:5173 (proxies /api → :8000)
```
If the backend enforces a key: create `.env.local` with
`VITE_API_KEY=your-platform-api-key`.

## What it shows
| Panel | Source | Detail |
|---|---|---|
| Workflow runs | `GET /runs` | Expandable rows → **step timeline**: each step is a clip-bar; width = share of run duration, color = ok/skipped/failed |
| LLM cost / model | `GET /metrics/usage` | 30-day spend, per-model bars, tokens in/out, avg latency |
| API jobs | `GET /jobs` | queued/running/done/failed with a pulsing tally dot on running |
| Health | `GET /health` | amber tally lamp + API version |

Panels poll (5–15s) — right-sized for a single-operator console; no websocket
infrastructure for one viewer.

## Design notes
The aesthetic borrows from the edit suite this platform feeds: slate console
panels, a tally-lamp amber accent reserved for live/status moments, IBM Plex
Mono for data, Space Grotesk for display. The signature element is the step
timeline — structure that encodes information (duration + status), not
decoration. Keyboard focus is visible; reduced-motion is respected.
