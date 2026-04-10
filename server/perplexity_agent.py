"""Perplexity agent module — Person B implements this.
Stubs provided so main.py can import without errors.
"""

from typing import Optional
from shared_types import WorkerAgentOutput, CriticAgentOutput


async def call_worker_agent(
    task: str,
    persona: str,
    improvement_notes: Optional[str] = None,
) -> WorkerAgentOutput:
    """Call a worker agent with the given task and persona."""
    raise NotImplementedError("Person B implements this")


async def call_critic_agent(
    task: str,
    worker_outputs: list[dict],
) -> CriticAgentOutput:
    """Call the critic agent to evaluate worker outputs."""
    raise NotImplementedError("Person B implements this")
