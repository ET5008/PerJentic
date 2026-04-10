import type { CritiqueData } from '../types'
import DirectiveBadge from './DirectiveBadge'

interface CritiquePanelProps {
  critique: CritiqueData
}

export default function CritiquePanel({ critique }: CritiquePanelProps) {
  return (
    <div className="mt-6 border-t border-gray-700 pt-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Critic Synthesis
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{critique.cross_agent}</p>
      </div>

      {critique.directives.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Improvement Directives for Next Round
          </h4>
          <div className="flex flex-col gap-2">
            {critique.directives.map((d, i) => (
              <DirectiveBadge key={i} text={d} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
