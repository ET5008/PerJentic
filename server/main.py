import asyncio
import json
import os

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agents import AGENTS, run_critic, run_worker
from models import ApproveRequest, CritiqueResult, RunRequest, SessionState

load_dotenv(Path(__file__).parent.parent / ".env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

session: SessionState | None = None


def get_api_key() -> str:
    key = os.getenv("PERPLEXITY_API_KEY", "")
    if not key:
        raise RuntimeError("PERPLEXITY_API_KEY is not set")
    return key


async def emit(q: asyncio.Queue, event: dict) -> None:
    await q.put(event)


async def run_loop(s: SessionState) -> None:
    api_key = get_api_key()
    print(f"[loop] session started | task={s.task[:60]!r}... | rounds={s.max_rounds} | auto={s.auto_mode}")

    for round_num in range(1, s.max_rounds + 1):
        s.round_num = round_num
        print(f"[loop] round {round_num}/{s.max_rounds} starting | directives={len(s.directives)}")
        await emit(s.sse_queue, {"type": "round_start", "round": round_num})

        # Run all workers in parallel
        worker_tasks = [
            run_worker(agent, s.task, s.directives, api_key)
            for agent in AGENTS
        ]
        print(f"[loop] dispatching {len(worker_tasks)} workers in parallel")
        try:
            results = await asyncio.gather(*worker_tasks)
            print(f"[loop] all workers complete | lengths={[len(r) for r in results]}")
        except Exception as exc:
            print(f"[loop] worker error: {exc}")
            await emit(s.sse_queue, {"type": "error", "message": f"Worker failed: {exc}"})
            await s.sse_queue.put(None)
            return

        agent_outputs: dict[str, str] = {}
        for agent, content in zip(AGENTS, results):
            agent_outputs[agent.id] = content
            print(f"[loop] emitting agent_output | agent={agent.id} ({agent.name}) | len={len(content)}")
            await emit(s.sse_queue, {
                "type": "agent_output",
                "round": round_num,
                "agent_id": agent.id,
                "persona": agent.name,
                "content": content,
            })

        # Run critic
        print(f"[loop] calling critic with {len(agent_outputs)} agent outputs")
        try:
            critique: CritiqueResult = await run_critic(s.task, agent_outputs, api_key)
            print(f"[loop] critic complete | directives={critique.directives}")
        except (ValueError, Exception) as exc:
            print(f"[loop] critic error: {exc}")
            await emit(s.sse_queue, {
                "type": "error",
                "message": f"Critic returned invalid output: {exc}",
            })
            await s.sse_queue.put(None)
            return

        await emit(s.sse_queue, {
            "type": "critique",
            "round": round_num,
            "per_agent": critique.per_agent,
            "cross_agent": critique.cross_agent,
            "directives": critique.directives,
        })

        action_required = not s.auto_mode
        await emit(s.sse_queue, {
            "type": "round_complete",
            "round": round_num,
            "action_required": action_required,
        })
        print(f"[loop] round {round_num} complete | action_required={action_required}")

        # Update directives for next round
        s.directives = critique.directives

        # Gate: wait for user approval unless auto_mode or last round
        if not s.auto_mode and round_num < s.max_rounds:
            print(f"[loop] waiting at approve gate for round {round_num}")
            s.approve_event.clear()
            await s.approve_event.wait()
            s.approve_event.clear()
            print(f"[loop] approve gate released, advancing to round {round_num + 1}")

    print(f"[loop] session complete after {s.max_rounds} rounds")
    await emit(s.sse_queue, {
        "type": "session_complete",
        "total_rounds": s.max_rounds,
        "message": "All rounds complete",
    })
    await s.sse_queue.put(None)


@app.post("/api/run")
async def api_run(req: RunRequest):
    global session
    print(f"[api] POST /api/run | agents={req.agents} rounds={req.max_rounds} auto={req.auto_mode}")
    session = SessionState(
        task=req.task,
        auto_mode=req.auto_mode,
        max_rounds=req.max_rounds,
    )
    asyncio.create_task(run_loop(session))
    print("[api] run_loop task created")
    return {"status": "started"}


@app.get("/api/stream")
async def api_stream():
    print("[api] GET /api/stream — client connected")
    if session is None:
        print("[api] /api/stream — no active session")
        async def no_session():
            yield f"data: {json.dumps({'type': 'error', 'message': 'No active session'})}\n\n"
        return StreamingResponse(no_session(), media_type="text/event-stream")

    q = session.sse_queue

    async def generator():
        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=15)
            except asyncio.TimeoutError:
                print("[sse] keepalive ping")
                yield ": keepalive\n\n"
                continue

            if item is None:
                print("[sse] sentinel received — closing stream")
                break

            print(f"[sse] sending event: type={item.get('type')}")
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/approve")
async def api_approve(req: ApproveRequest):
    print(f"[api] POST /api/approve | action={req.action}")
    if session is None:
        print("[api] /api/approve — no active session")
        return {"status": "error", "message": "No active session"}
    session.approve_event.set()
    print("[api] approve_event set — loop unblocked")
    return {"status": "ok", "action": req.action}
