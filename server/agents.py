import json
from dataclasses import dataclass
from openai import AsyncOpenAI
from models import CritiqueResult

PERPLEXITY_BASE_URL = "https://api.perplexity.ai"
MODEL = "sonar-pro"


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
) -> str:
    client = AsyncOpenAI(base_url=PERPLEXITY_BASE_URL, api_key=api_key)

    if directives:
        directives_block = (
            "Prior round improvement directives to incorporate into your analysis:\n"
            + "\n".join(f"- {d}" for d in directives)
        )
    else:
        directives_block = "This is the first round — give your best initial analysis."

    user_message = f"Task: {task}\n\n{directives_block}"

    print(f"[worker:{agent.id}] calling Perplexity sonar-pro | directives={len(directives)}")
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": agent.system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    result = response.choices[0].message.content or ""
    print(f"[worker:{agent.id}] response received | len={len(result)}")
    return result


async def run_critic(
    task: str,
    agent_outputs: dict[str, str],
    api_key: str,
) -> CritiqueResult:
    client = AsyncOpenAI(base_url=PERPLEXITY_BASE_URL, api_key=api_key)

    outputs_block = "\n\n".join(
        f"=== Agent {agent_id} ===\n{content}"
        for agent_id, content in agent_outputs.items()
    )

    system_prompt = (
        "You are a meta-analyst reviewing parallel analyses from multiple agents. "
        "You MUST respond with ONLY a JSON object — no markdown fences, no commentary before or after. "
        "The JSON must match this exact schema:\n"
        '{"per_agent": {"<agent_id>": "<what they did well + specific gap>"}, '
        '"cross_agent": "<patterns and disagreements across all agents>", '
        '"directives": ["<concrete improvement instruction 1>", "<concrete improvement instruction 2>", ...]}\n'
        "Directives should be specific, actionable instructions that all agents should incorporate in the next round."
    )

    user_message = (
        f"Task under analysis: {task}\n\n"
        f"Agent outputs to review:\n\n{outputs_block}\n\n"
        "Provide your meta-critique as a JSON object."
    )

    print(f"[critic] calling Perplexity sonar-pro with {len(agent_outputs)} agent outputs")
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    raw = response.choices[0].message.content or ""
    print(f"[critic] raw response received | len={len(raw)} | preview={raw[:120]!r}")

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.lstrip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rstrip("`").strip()

    print(f"[critic] parsing JSON | cleaned preview={cleaned[:120]!r}")
    parsed = json.loads(cleaned)
    result = CritiqueResult.model_validate(parsed)
    print(f"[critic] validated OK | directives={result.directives}")
    return result
