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
    """Call a worker agent with the given task and persona. (Mock for testing)"""
    import asyncio
    await asyncio.sleep(0.5)  # Simulate latency
    agent_id = persona.split()[-1].lower().rstrip(".")
    notes_part = f" (incorporating feedback: {improvement_notes})" if improvement_notes else ""
    return WorkerAgentOutput(
        agent_id=agent_id,
        output=f"[{agent_id}] Analysis of '{task}' from perspective of '{persona}'{notes_part}. This is mock output.",
    )


async def call_critic_agent(
    task: str,
    worker_outputs: list[dict],
) -> CriticAgentOutput:
    """Call the critic agent to evaluate worker outputs. (Mock for testing)"""
    import asyncio
    await asyncio.sleep(0.3)  # Simulate latency
    per_agent = {wo["agent_id"]: f"Feedback for {wo['agent_id']}: solid work, needs more depth." for wo in worker_outputs}
    return CriticAgentOutput(
        per_agent=per_agent,
        cross_agent="Both agents should collaborate more on shared data points.",
        directives="Focus on quantitative metrics and cite specific data from the report.",
    )
