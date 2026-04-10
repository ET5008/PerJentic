"""Event bus module — Person C implements this.
Stubs provided so main.py can import without errors.
"""

import asyncio
import json
import uuid
from typing import Any, AsyncGenerator


class EventBus:
    """Pub/sub event bus for SSE streaming."""

    def __init__(self) -> None:
        self._subscribers: dict[str, asyncio.Queue] = {}

    def subscribe(self) -> tuple[str, asyncio.Queue]:
        """Register a new subscriber. Returns (subscriber_id, queue)."""
        subscriber_id = str(uuid.uuid4())
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[subscriber_id] = queue
        return subscriber_id, queue

    def unsubscribe(self, subscriber_id: str) -> None:
        """Remove a subscriber."""
        self._subscribers.pop(subscriber_id, None)

    async def publish_event(self, event: dict[str, Any]) -> None:
        """Publish an event to all subscribers."""
        for queue in self._subscribers.values():
            await queue.put(event)


async def stream_events(queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted strings from a queue."""
    while True:
        event = await queue.get()
        if event is None:
            break
        yield f"data: {json.dumps(event)}\n\n"


# --- Event factory helpers (Person C implements full versions) ---

def create_session_start_event(session_id: str) -> dict:
    return {"type": "session_start", "session_id": session_id}


def create_round_start_event(round_number: int) -> dict:
    return {"type": "round_start", "round_number": round_number}


def create_agent_result_event(round_number: int, agent_id: str, output: str) -> dict:
    return {"type": "agent_result", "round_number": round_number, "agent_id": agent_id, "output": output}


def create_critic_result_event(round_number: int, per_agent: dict, cross_agent: str, directives: str) -> dict:
    return {"type": "critic_result", "round_number": round_number, "per_agent": per_agent, "cross_agent": cross_agent, "directives": directives}


def create_waiting_for_approval_event(round_number: int, can_continue: bool) -> dict:
    return {"type": "waiting_for_approval", "round_number": round_number, "can_continue": can_continue}


def create_round_complete_event(round_number: int, next_round: int | None) -> dict:
    return {"type": "round_complete", "round_number": round_number, "next_round": next_round}


def create_session_complete_event(session_id: str) -> dict:
    return {"type": "session_complete", "session_id": session_id}


def create_error_event(message: str) -> dict:
    return {"type": "error", "message": message}
