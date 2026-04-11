import type { RoundData } from '../types'
import AgentOutput from './AgentOutput'
import CritiquePanel from './CritiquePanel'
import type { DirectiveControls } from './CritiquePanel'

interface RoundCardProps {
  round: RoundData
  totalAgents: number
  directiveControls?: DirectiveControls
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex gap-2 items-center">
        <div className="h-5 w-16 bg-gray-700 rounded-full" />
        <div className="h-4 w-24 bg-gray-700 rounded" />
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="h-3 w-full bg-gray-800 rounded" />
        <div className="h-3 w-5/6 bg-gray-800 rounded" />
        <div className="h-3 w-4/6 bg-gray-800 rounded" />
        <div className="h-3 w-full bg-gray-800 rounded" />
        <div className="h-3 w-3/4 bg-gray-800 rounded" />
      </div>
    </div>
  )
}

export default function RoundCard({ round, totalAgents, directiveControls }: RoundCardProps) {
  const skeletonCount = totalAgents - round.agents.length

  return (
    <div className="border border-gray-800 rounded-2xl p-6 bg-gray-900/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold">
          {round.round}
        </div>
        <h2 className="text-lg font-semibold text-gray-100">Round {round.round}</h2>
        {round.status === 'running' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-indigo-400">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Running…
          </span>
        )}
        {round.status === 'awaiting_approval' && (
          <span className="ml-auto text-xs text-yellow-400 font-medium">
            Awaiting approval
          </span>
        )}
        {round.status === 'complete' && (
          <span className="ml-auto text-xs text-green-400 font-medium">Complete</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {round.agents.map((a) => (
          <AgentOutput
            key={a.agent_id}
            output={a}
            criticNote={round.critique?.per_agent[a.agent_id]}
          />
        ))}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={`skeleton-${i}`} />
        ))}
      </div>

      {round.critique && <CritiquePanel critique={round.critique} controls={directiveControls} />}
    </div>
  )
}
