import type { ActionPlanData } from '../types'

interface ActionPlanPanelProps {
  plan: ActionPlanData
}

export default function ActionPlanPanel({ plan }: ActionPlanPanelProps) {
  return (
    <div className="border border-indigo-800/60 rounded-2xl bg-indigo-950/30 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">Action Plan</h2>
        <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-900/60 text-indigo-300">
          Final Synthesis
        </span>
      </div>

      <p className="text-gray-300 text-sm leading-relaxed border-l-2 border-indigo-600 pl-4">
        {plan.summary}
      </p>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Recommended Actions
        </h3>
        <ol className="flex flex-col gap-2">
          {plan.actions.map((action, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-700 text-white text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-gray-200 leading-relaxed">{action}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
