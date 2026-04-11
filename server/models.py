import asyncio
from dataclasses import dataclass, field
from typing import Literal
from pydantic import BaseModel


class RunRequest(BaseModel):
    task: str
    agents: int = 3
    auto_mode: bool = False
    max_rounds: int = 3


class ApproveRequest(BaseModel):
    action: Literal["approve", "skip"]
    directives: list[str] | None = None


class CritiqueResult(BaseModel):
    per_agent: dict[str, str]
    cross_agent: str
    directives: list[str]


class ActionPlanResult(BaseModel):
    summary: str
    actions: list[str]


@dataclass
class SessionState:
    task: str
    auto_mode: bool
    max_rounds: int
    round_num: int = 0
    directives: list[str] = field(default_factory=list)
    all_round_outputs: list[dict[str, str]] = field(default_factory=list)
    approve_event: asyncio.Event = field(default_factory=asyncio.Event)
    sse_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
