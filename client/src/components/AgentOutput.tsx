import { AgentOutputData } from '../types'

interface AgentOutputProps {
  output: AgentOutputData
  criticNote?: string
}

const AGENT_STYLES: Record<string, { border: string; header: string; badge: string }> = {
  A: {
    border: 'border-red-500/50',
    header: 'bg-red-950/30',
    badge: 'bg-red-900/50 text-red-300',
  },
  B: {
    border: 'border-green-500/50',
    header: 'bg-green-950/30',
    badge: 'bg-green-900/50 text-green-300',
  },
  C: {
    border: 'border-blue-500/50',
    header: 'bg-blue-950/30',
    badge: 'bg-blue-900/50 text-blue-300',
  },
}

const DEFAULT_STYLE = {
  border: 'border-gray-600/50',
  header: 'bg-gray-800/50',
  badge: 'bg-gray-700 text-gray-300',
}

export default function AgentOutput({ output, criticNote }: AgentOutputProps) {
  const style = AGENT_STYLES[output.agent_id] ?? DEFAULT_STYLE

  return (
    <div className={`rounded-xl border ${style.border} bg-gray-900 flex flex-col overflow-hidden`}>
      <div className={`px-4 py-3 ${style.header} flex items-center gap-2 border-b border-gray-800`}>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
          Agent {output.agent_id}
        </span>
        <span className="text-sm font-semibold text-gray-200">{output.persona}</span>
      </div>
      <div className="px-4 py-3 flex-1 max-h-72 overflow-y-auto">
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{output.content}</p>
      </div>
      {criticNote && (
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-950/50">
          <p className="text-xs text-yellow-400/80">
            <span className="font-semibold text-yellow-400">Critic noted: </span>
            {criticNote}
          </p>
        </div>
      )}
    </div>
  )
}
