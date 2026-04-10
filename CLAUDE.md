# PerJentic — Claude Context

## What this project is
A full-stack hackathon demo: a multi-agent critique-revise loop powered by the **Perplexity Sonar API**. N worker agents analyze a task in parallel across multiple rounds. After each round a critic agent synthesizes their output and generates improvement directives. The user approves or skips between rounds. The UI streams round progress in real time via SSE.

## Stack
- **Backend:** FastAPI + Python (async) — `server/`
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Vite — `client/`
- **LLM:** Perplexity Sonar API (`sonar-pro` model, OpenAI-compatible format)
- **No database** — all state is in-memory for the session

## Project structure
```
PerJentic/
├── .env                         # PERPLEXITY_API_KEY (root level)
├── CLAUDE.md                    # this file
├── client/
│   └── src/
│       ├── App.tsx              # main app: config form, SSE handler, round list, approve bar
│       ├── types.ts             # SSE event discriminated union + all shared interfaces
│       └── components/
│           ├── RoundCard.tsx    # per-round card: agent grid + skeleton + critique
│           ├── AgentOutput.tsx  # individual agent card (color-coded A/B/C)
│           ├── CritiquePanel.tsx # cross-agent synthesis + directive badges
│           └── DirectiveBadge.tsx # numbered pill badge (amber/purple/cyan)
└── server/
    ├── main.py                  # FastAPI app: /api/run, /api/stream (SSE), /api/approve
    ├── agents.py                # run_worker + run_critic async functions; AGENTS constant
    ├── models.py                # Pydantic models + SessionState dataclass
    └── requirements.txt
```

## How to run
**Backend** (Terminal 1):
```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend** (Terminal 2):
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Key architecture decisions
- **Single global `session`** in `main.py` — one active session at a time, no auth, no persistence
- **`asyncio.gather`** for parallel worker calls — all agents run truly simultaneously
- **`asyncio.Event`** for the approve gate — `run_loop` suspends at `await approve_event.wait()` without blocking FastAPI
- **SSE keepalive** — `asyncio.wait_for(queue.get(), timeout=15)` yields `: keepalive\n\n` to prevent connection drops at the approve gate
- **Critic JSON** — stripped of markdown fences, validated with `CritiqueResult.model_validate()` before emitting to frontend
- **`import type`** on all type-only imports in `.tsx` files — required for Vite ESM to resolve `types.ts` correctly
- **`.env` at project root** — `main.py` loads it via `Path(__file__).parent.parent / ".env"`

## SSE event schema
All events are `data: <JSON>\n\n`. The `type` field is inside the JSON.
```
round_start      { type, round }
agent_output     { type, round, agent_id, persona, content }
critique         { type, round, per_agent, cross_agent, directives }
round_complete   { type, round, action_required }
session_complete { type, total_rounds, message }
error            { type, message }
```

## Agent personas
- **Agent A** — Skeptical Analyst: weaknesses, risks, counterarguments
- **Agent B** — Optimist: strongest signals, momentum, bull case
- **Agent C** — Synthesizer: most defensible balanced view

## Default demo task
> "Analyze the current state of neurotech and BCI companies — what's promising, what's overhyped, and what's the best investment thesis right now?"

## Known limitations / future work
- Starting a new session while one is running silently replaces the global session
- No auto-reconnect if the backend restarts mid-session
- No retry logic on Perplexity API failures
- Critic JSON parsing may fail on unusual model output — emits SSE error and halts gracefully

---

## Instructions for updating this file
**Update CLAUDE.md whenever you:**
- Add, remove, or rename files in `server/` or `client/src/`
- Change how the backend is started (venv path, port, env vars)
- Add new API endpoints or change the SSE event schema
- Change the agent personas or default task
- Make architectural decisions worth preserving (why something was done a certain way)
- Fix a non-obvious bug that future Claude sessions should know about

**Keep it concise** — bullet points and code blocks over prose. The goal is that a future Claude session can read this file and immediately understand the project without exploring the codebase from scratch.
