import asyncio
import json
from dataclasses import dataclass
from perplexity import AsyncPerplexity
from models import ActionPlanResult, CritiqueResult

PRESET = "pro-search"       # 3 web-search steps per worker call
MAX_STEPS = 3
WORKER_STAGGER_DELAY = 0.4  # seconds between worker launches (Tier-0 rate limit: 1 QPS)


@dataclass
class AgentPersona:
    id: str
    name: str
    system_prompt: str


AGENTS: list[AgentPersona] = [
    AgentPersona(
        id="A",
        name="Skeptical Analyst",
        system_prompt=(
            "You are a rigorous skeptic and contrarian analyst. "
            "Focus on weaknesses, risks, counterarguments, and what is overhyped. "
            "Be specific, cite evidence where possible, and challenge assumptions. "
            "Your job is to stress-test claims and find what could go wrong."
        ),
    ),
    AgentPersona(
        id="B",
        name="Optimist",
        system_prompt=(
            "You are a bullish analyst focused on opportunity. "
            "Find the strongest signals, momentum indicators, tailwinds, and the most compelling opportunity. "
            "Be specific, cite concrete data points, and build the most persuasive bull case. "
            "Your job is to identify what could go right and why."
        ),
    ),
    AgentPersona(
        id="C",
        name="Synthesizer",
        system_prompt=(
            "You are a balanced, epistemically rigorous analyst. "
            "Weigh all perspectives to arrive at the most defensible, nuanced view. "
            "Your goal is accuracy over consensus — acknowledge uncertainty where it exists, "
            "identify where the bears and bulls are each partially right, and produce the most credible overall assessment."
        ),
    ),
]


async def run_worker(
    agent: AgentPersona,
    task: str,
    directives: list[str],
    api_key: str,
    index: int = 0,
) -> str:
    # Stagger launches to stay within Tier-0 rate limit (1 QPS)
    if index > 0:
        await asyncio.sleep(index * WORKER_STAGGER_DELAY)

    client = AsyncPerplexity(api_key=api_key)

    if directives:
        directives_block = (
            "Prior round improvement directives to incorporate into your analysis:\n"
            + "\n".join(f"- {d}" for d in directives)
        )
    else:
        directives_block = "This is the first round — give your best initial analysis."

    user_message = f"Task: {task}\n\n{directives_block}"

    print(f"[worker:{agent.id}] calling Perplexity Agent API | preset={PRESET} | index={index}")
    response = await client.responses.create(
        preset=PRESET,
        input=user_message,
        instructions=agent.system_prompt,
        max_steps=MAX_STEPS,
    )
    result = response.output_text or ""
    print(f"[worker:{agent.id}] response received | len={len(result)}")
    return result


async def run_critic(
    task: str,
    agent_outputs: dict[str, str],
    api_key: str,
) -> CritiqueResult:
    client = AsyncPerplexity(api_key=api_key)

    outputs_block = "\n\n".join(
        f"=== Agent {agent_id} ===\n{content}"
        for agent_id, content in agent_outputs.items()
    )

    instructions = (
        "You are a meta-analyst reviewing parallel analyses from multiple agents. "
        "You MUST respond with ONLY a JSON object — no markdown fences, no preamble, no commentary. "
        "The JSON must match this exact schema:\n"
        '{"per_agent": {"<agent_id>": "<what they did well + specific gap>"}, '
        '"cross_agent": "<patterns and disagreements across all agents>", '
        '"directives": ["<concrete improvement instruction 1>", "<concrete improvement instruction 2>", ...]}\n'
        "Directives should be specific, actionable instructions that all agents should incorporate in the next round. "
        "Do not include any text outside the JSON object. Start your response with { and end with }."
    )

    user_message = (
        f"Task under analysis: {task}\n\n"
        f"Agent outputs to review:\n\n{outputs_block}\n\n"
        "Provide your meta-critique as a JSON object."
    )

    print(f"[critic] calling Perplexity Agent API | preset=fast-search | agents={len(agent_outputs)}")
    response = await client.responses.create(
        preset="fast-search",
        input=user_message,
        instructions=instructions,
        max_steps=1,
    )

    raw = response.output_text or ""
    print(f"[critic] raw response received | len={len(raw)} | preview={raw[:120]!r}")

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.lstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rstrip("`").strip()

    # Fallback: extract JSON substring if model added surrounding prose
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            cleaned = cleaned[start:end]

    print(f"[critic] parsing JSON | cleaned preview={cleaned[:120]!r}")
    parsed = json.loads(cleaned)
    result = CritiqueResult.model_validate(parsed)
    print(f"[critic] validated OK | directives={result.directives}")
    return result


async def run_synthesizer(
    task: str,
    all_round_outputs: list[dict[str, str]],
    api_key: str,
) -> ActionPlanResult:
    """Final synthesis pass: distill all rounds into a concise action plan."""
    client = AsyncPerplexity(api_key=api_key)

    rounds_block = "\n\n".join(
        "=== Round {} ===\n{}".format(
            round_num + 1,
            "\n\n".join(f"Agent {aid}:\n{content}" for aid, content in outputs.items()),
        )
        for round_num, outputs in enumerate(all_round_outputs)
    )

    instructions = (
        "You are a senior advisor synthesizing a multi-round research process into a final action plan. "
        "You MUST respond with ONLY a JSON object — no markdown fences, no preamble, no commentary. "
        "The JSON must match this exact schema:\n"
        '{"summary": "<2-3 sentence executive summary of the overall conclusion>", '
        '"actions": ["<concise action item 1>", "<concise action item 2>", ...]}\n'
        "Actions should be concrete, prioritized, and directly actionable by the user — not vague recommendations. "
        "Aim for 4-7 action items. Do not include any text outside the JSON object. Start with { and end with }."
    )

    user_message = (
        f"Task: {task}\n\n"
        f"Research across {len(all_round_outputs)} round(s):\n\n{rounds_block}\n\n"
        "Produce a final action plan JSON."
    )

    print(f"[synthesizer] calling Perplexity Agent API | rounds={len(all_round_outputs)}")
    response = await client.responses.create(
        preset="fast-search",
        input=user_message,
        instructions=instructions,
        max_steps=1,
    )

    raw = response.output_text or ""
    print(f"[synthesizer] raw response | len={len(raw)} | preview={raw[:120]!r}")

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.lstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rstrip("`").strip()

    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            cleaned = cleaned[start:end]

    parsed = json.loads(cleaned)
    result = ActionPlanResult.model_validate(parsed)
    print(f"[synthesizer] validated OK | actions={len(result.actions)}")
    return result
