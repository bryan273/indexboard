---
last_updated: 2026-10-24T16:55:22Z
---

# Architecture Design

## System Overview
IndexBoard: anonymous leaderboard boards. Frontend (Vite/React/shadcn) talks to Atoms Cloud FastAPI via web-sdk `client.apiCall.invoke`. Table `boards` (slug, title, description, payload_json, edit_key_hash).

## Tech Stack
React 18 + TS + Tailwind + shadcn/ui, inline SVG charts, markdown-to-jsx; FastAPI + SQLAlchemy async (Atoms Cloud).

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Board API | create/get/update/verify with hashed edit key | app/backend/routers/indexboard.py |
| Domain | types, tie/interval analysis, Pareto frontier, CSV/JSON import, draft validation, example | src/lib/board.ts |
| API client | web-sdk calls, local key store, JSON download | src/lib/boardApi.ts |
| i18n | EN/中文 dictionary + LangProvider | src/lib/i18n.tsx |
| Charts | BarChart (whiskers), ScatterChart (frontier), PNG copy | src/components/board/* |
| Pages | Index, EditorPage (/new, /b/:slug/edit), BoardPage (/b/:slug), PrintPage (/b/:slug/print) | src/pages/* |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access | Removed generated entity router; custom /api/v1/indexboard | keep edit_key_hash private |
| Edit auth | random key, sha256 stored, key in localStorage | anonymous ownership without login |
| Tie rule | item tied if 95% interval overlaps leader's | honest-by-default |

## File Tree Plan
See Module Design.

## Implementation Guide
Payload JSON: {metrics[{id,name,unit,direction}], items[{id,name,scores{metricId:{value,low,high,runs}}}], methodology{formula,worked_example,held_fixed[]}, primary_metric_id, cost_metric_id}.

