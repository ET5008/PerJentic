"""Shared Pydantic models for the multi-agent critique system."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AgentConfig(BaseModel):
    id: str
    persona: str


class SessionConfig(BaseModel):
    task: str
    agents: list[AgentConfig]
    max_rounds: int = 3
    auto_mode: bool = False


class RoundOutput(BaseModel):
    agent_id: str
    output: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CriticFeedback(BaseModel):
    per_agent: dict[str, str] = {}
    cross_agent: str = ""
    directives: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RoundState(BaseModel):
    round_number: int
    worker_outputs: list[RoundOutput] = []
    critic_output: Optional[CriticFeedback] = None
    is_approved: bool = False


class SessionState(BaseModel):
    session_id: str
    config: SessionConfig
    rounds: list[RoundState] = []
    current_round: int = 0
    is_paused: bool = True
    is_complete: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RunRequest(BaseModel):
    session_config: SessionConfig


class RunResponse(BaseModel):
    session_id: str
    message: str


class ApproveRequest(BaseModel):
    session_id: str
    action: str = "approve"


class ApproveResponse(BaseModel):
    session_id: str
    status: str
    message: str


class WorkerAgentOutput(BaseModel):
    agent_id: str
    output: str


class CriticAgentOutput(BaseModel):
    per_agent: dict[str, str] = {}
    cross_agent: str = ""
    directives: str = ""
