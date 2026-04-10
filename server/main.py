"""Multi-Agent Critique System — Backend Orchestrator (Task 1).

FastAPI application that orchestrates multi-round AI agent collaboration
with human feedback gates via three REST endpoints and a background
orchestration loop.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse

from shared_types import (
    SessionConfig,
    SessionState,
    RoundState,
    RoundOutput,
    CriticFeedback,
    RunRequest,
    RunResponse,
    ApproveRequest,
    ApproveResponse,
)
from perplexity_agent import call_worker_agent, call_critic_agent
from event_bus import (
    EventBus,
    stream_events,
    create_session_start_event,
    create_round_start_event,
    create_agent_result_event,
    create_critic_result_event,
    create_waiting_for_approval_event,
    create_round_complete_event,
    create_session_complete_event,
    create_error_event,
)

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

app = FastAPI(title="Multi-Agent Critique System")
sessions: dict[str, SessionState] = {}
event_bus = EventBus()


# ---------------------------------------------------------------------------
# Lifecycle events
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup() -> None:
    print("[FastAPI] Multi-Agent Critique System starting...")


@app.on_event("shutdown")
async def shutdown() -> None:
    print("[FastAPI] Multi-Agent Critique System shutting down...")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check() -> dict:
    """Simple health check."""
    return {"status": "ok", "active_sessions": len(sessions)}


@app.post("/api/run", response_model=RunResponse)
async def start_session(request: RunRequest) -> RunResponse:
    """Start a new multi-agent critique session.

    Creates a session, stores it in memory, publishes a session_start event,
    and kicks off the background orchestration loop.
    """
    config: SessionConfig = request.session_config
    session_id: str = str(uuid.uuid4())

    session = SessionState(
        session_id=session_id,
        config=config,
        rounds=[],
        current_round=0,
        is_paused=True,
        is_complete=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    sessions[session_id] = session

    await event_bus.publish_event(create_session_start_event(session_id))
    print(f"[Orchestrator] Session {session_id} created")

    # Fire the orchestration loop as a background task
    asyncio.create_task(orchestration_loop(session_id))

    return RunResponse(session_id=session_id, message=f"Session {session_id} started.")


@app.post("/api/approve", response_model=ApproveResponse)
async def approve_round(request: ApproveRequest) -> ApproveResponse:
    """Approve the current round, unblocking the orchestration loop."""
    session = sessions.get(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.is_complete:
        raise HTTPException(status_code=400, detail="Session is already complete")

    if session.current_round == 0 or session.current_round > len(session.rounds):
        raise HTTPException(status_code=400, detail="No round is currently awaiting approval")

    round_state: RoundState = session.rounds[session.current_round - 1]

    if round_state.is_approved:
        raise HTTPException(status_code=400, detail=f"Round {session.current_round} is already approved")

    round_state.is_approved = True
    session.updated_at = datetime.utcnow()
    print(f"[Orchestrator] Round {session.current_round} approved for session {request.session_id}")

    return ApproveResponse(
        session_id=request.session_id,
        status="success",
        message=f"Round {session.current_round} approved. Continuing to next round.",
    )


@app.get("/api/stream")
async def stream(session_id: str = Query(..., description="Session ID to stream events for")) -> StreamingResponse:
    """Open an SSE event stream for the given session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    subscriber_id, queue = event_bus.subscribe()
    print(f"[Orchestrator] SSE subscriber {subscriber_id} connected for session {session_id}")

    async def event_generator():
        try:
            async for chunk in stream_events(queue):
                yield chunk
        finally:
            event_bus.unsubscribe(subscriber_id)
            print(f"[Orchestrator] SSE subscriber {subscriber_id} disconnected")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Orchestration loop — the core round-by-round state machine
# ---------------------------------------------------------------------------

async def orchestration_loop(session_id: str) -> None:
    """Run the multi-round orchestration for a session.

    Each round:
      1. Call all worker agents in parallel
      2. Feed results to the critic agent
      3. Wait for human approval (unless auto_mode is on)
    """
    session = sessions.get(session_id)
    if session is None:
        print(f"[Orchestrator] Session {session_id} not found — aborting loop")
        return

    try:
        for round_num in range(1, session.config.max_rounds + 1):
            session.current_round = round_num

            # Create and register the round
            round_state = RoundState(round_number=round_num)
            session.rounds.append(round_state)

            await event_bus.publish_event(create_round_start_event(round_num))
            print(f"[Orchestrator] Round {round_num} started for session {session_id}")

            # ----------------------------------------------------------
            # Phase 1: Parallel worker agent calls
            # ----------------------------------------------------------
            improvement_notes: Optional[str] = None
            if round_num > 1:
                prev_critic = session.rounds[round_num - 2].critic_output
                if prev_critic is not None:
                    improvement_notes = prev_critic.directives

            agent_tasks: list[tuple[str, asyncio.Task]] = []
            for agent in session.config.agents:
                coro = call_worker_agent(
                    task=session.config.task,
                    persona=agent.persona,
                    improvement_notes=improvement_notes,
                )
                agent_tasks.append((agent.id, coro))

            results = await asyncio.gather(
                *[coro for _, coro in agent_tasks],
                return_exceptions=True,
            )

            for (agent_id, _), result in zip(agent_tasks, results):
                if isinstance(result, Exception):
                    error_msg = f"Agent {agent_id} failed: {result}"
                    print(f"[Orchestrator] {error_msg}")
                    await event_bus.publish_event(create_error_event(error_msg))
                    continue

                round_output = RoundOutput(
                    agent_id=result.agent_id,
                    output=result.output,
                    timestamp=datetime.utcnow(),
                )
                round_state.worker_outputs.append(round_output)

                await event_bus.publish_event(
                    create_agent_result_event(
                        round_number=round_num,
                        agent_id=result.agent_id,
                        output=result.output,
                    )
                )

            # ----------------------------------------------------------
            # Phase 2: Critic evaluation
            # ----------------------------------------------------------
            worker_outputs_list = [
                {"agent_id": wo.agent_id, "output": wo.output}
                for wo in round_state.worker_outputs
            ]

            try:
                critic_result = await call_critic_agent(
                    task=session.config.task,
                    worker_outputs=worker_outputs_list,
                )

                round_state.critic_output = CriticFeedback(
                    per_agent=critic_result.per_agent,
                    cross_agent=critic_result.cross_agent,
                    directives=critic_result.directives,
                    timestamp=datetime.utcnow(),
                )

                await event_bus.publish_event(
                    create_critic_result_event(
                        round_number=round_num,
                        per_agent=critic_result.per_agent,
                        cross_agent=critic_result.cross_agent,
                        directives=critic_result.directives,
                    )
                )
                print(f"[Orchestrator] Critic completed for round {round_num}")
            except Exception as e:
                error_msg = f"Critic failed: {e}"
                print(f"[Orchestrator] {error_msg}")
                await event_bus.publish_event(create_error_event(error_msg))
                session.is_complete = True
                break

            # ----------------------------------------------------------
            # Phase 3: Approval gate
            # ----------------------------------------------------------
            can_continue = round_num < session.config.max_rounds

            if session.config.auto_mode:
                print(f"[Orchestrator] Auto mode: skipping approval for round {round_num}")

                await event_bus.publish_event(
                    create_round_complete_event(
                        round_number=round_num,
                        next_round=(round_num + 1) if can_continue else None,
                    )
                )

                if not can_continue:
                    session.is_complete = True
                    break
            else:
                print(f"[Orchestrator] Waiting for user approval on round {round_num}")

                await event_bus.publish_event(
                    create_waiting_for_approval_event(
                        round_number=round_num,
                        can_continue=can_continue,
                    )
                )

                # Block until POST /api/approve sets is_approved = True
                while not round_state.is_approved:
                    await asyncio.sleep(0.5)

                print(f"[Orchestrator] Round {round_num} approved by user")

                await event_bus.publish_event(
                    create_round_complete_event(
                        round_number=round_num,
                        next_round=(round_num + 1) if can_continue else None,
                    )
                )

                if not can_continue:
                    session.is_complete = True
                    break

        # All rounds finished
        session.is_complete = True
        session.updated_at = datetime.utcnow()
        await event_bus.publish_event(create_session_complete_event(session_id))
        print(f"[Orchestrator] Session {session_id} complete")

    except Exception as e:
        error_msg = f"Orchestration loop failed: {e}"
        print(f"[Orchestrator] {error_msg}")
        await event_bus.publish_event(create_error_event(error_msg))
        session.is_complete = True
        session.updated_at = datetime.utcnow()
