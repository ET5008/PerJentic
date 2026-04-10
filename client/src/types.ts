export type SSEEvent =
  | { type: 'round_start'; round: number }
  | { type: 'agent_output'; round: number; agent_id: string; persona: string; content: string }
  | { type: 'critique'; round: number; per_agent: Record<string, string>; cross_agent: string; directives: string[] }
  | { type: 'round_complete'; round: number; action_required: boolean }
  | { type: 'session_complete'; total_rounds: number; message: string }
  | { type: 'error'; message: string }

export interface AgentOutputData {
  agent_id: string
  persona: string
  content: string
}

export interface CritiqueData {
  per_agent: Record<string, string>
  cross_agent: string
  directives: string[]
}

export interface RoundData {
  round: number
  agents: AgentOutputData[]
  critique: CritiqueData | null
  status: 'running' | 'awaiting_approval' | 'complete'
}

export interface SessionConfig {
  task: string
  agents: number
  auto_mode: boolean
  max_rounds: number
}

export type AppStatus = 'idle' | 'running' | 'awaiting_approval' | 'complete' | 'error'

// Runtime sentinel so this module is never empty after TypeScript erasure
export const _types = true
