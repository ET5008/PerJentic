import { useRef, useState } from 'react'
import ActionPlanPanel from './components/ActionPlanPanel'
import RoundCard from './components/RoundCard'
import type { ActionPlanData, AgentOutputData, AppStatus, CritiqueData, RoundData, SessionConfig, SSEEvent } from './types'

const DEFAULT_TASK =
  'Analyze the current state of neurotech and BCI companies — what\'s promising, what\'s overhyped, and what\'s the best investment thesis right now?'

const API = 'http://localhost:8000'

export default function App() {
  const [config, setConfig] = useState<SessionConfig>({
    task: DEFAULT_TASK,
    agents: 3,
    auto_mode: false,
    max_rounds: 3,
  })
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [status, setStatus] = useState<AppStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingDirectives, setPendingDirectives] = useState<string[]>([])
  const [actionPlan, setActionPlan] = useState<ActionPlanData | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  function handleEvent(e: SSEEvent) {
    console.log(`[SSE] event received: type=${e.type}`, e)
    switch (e.type) {
      case 'round_start':
        console.log(`[SSE] round_start → round ${e.round}`)
        setRounds((prev) => [
          ...prev,
          { round: e.round, agents: [], critique: null, status: 'running' },
        ])
        break

      case 'agent_output': {
        console.log(`[SSE] agent_output → round ${e.round}, agent ${e.agent_id} (${e.persona}), length=${e.content.length}`)
        const output: AgentOutputData = {
          agent_id: e.agent_id,
          persona: e.persona,
          content: e.content,
        }
        setRounds((prev) =>
          prev.map((r) =>
            r.round === e.round ? { ...r, agents: [...r.agents, output] } : r
          )
        )
        break
      }

      case 'critique': {
        console.log(`[SSE] critique → round ${e.round}, directives=${e.directives.length}`, e.directives)
        const critique: CritiqueData = {
          per_agent: e.per_agent,
          cross_agent: e.cross_agent,
          directives: e.directives,
        }
        setRounds((prev) =>
          prev.map((r) => (r.round === e.round ? { ...r, critique } : r))
        )
        setPendingDirectives(e.directives)
        break
      }

      case 'round_complete':
        console.log(`[SSE] round_complete → round ${e.round}, action_required=${e.action_required}`)
        setRounds((prev) =>
          prev.map((r) =>
            r.round === e.round
              ? { ...r, status: e.action_required ? 'awaiting_approval' : 'complete' }
              : r
          )
        )
        if (e.action_required) {
          setStatus('awaiting_approval')
        }
        break

      case 'action_plan':
        console.log(`[SSE] action_plan → actions=${e.actions.length}`)
        setActionPlan({ summary: e.summary, actions: e.actions })
        break

      case 'session_complete':
        console.log(`[SSE] session_complete → total_rounds=${e.total_rounds}`)
        setRounds((prev) =>
          prev.map((r) => (r.status !== 'complete' ? { ...r, status: 'complete' } : r))
        )
        setStatus('complete')
        eventSourceRef.current?.close()
        break

      case 'error':
        console.error(`[SSE] error →`, e.message)
        setErrorMsg(e.message)
        setStatus('error')
        eventSourceRef.current?.close()
        break
    }
  }

  async function handleStart() {
    console.log('[App] starting session', config)
    setRounds([])
    setStatus('running')
    setErrorMsg(null)
    setActionPlan(null)

    eventSourceRef.current?.close()

    console.log('[App] POST /api/run')
    const runRes = await fetch(`${API}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    console.log('[App] /api/run response', await runRes.json())

    console.log('[App] opening SSE stream at /api/stream')
    const es = new EventSource(`${API}/api/stream`)
    eventSourceRef.current = es

    es.onopen = () => console.log('[SSE] connection opened')

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data)
        handleEvent(data)
      } catch (err) {
        console.warn('[SSE] failed to parse message:', event.data, err)
      }
    }

    es.onerror = (err) => {
      console.error('[SSE] connection error', err)
      if (status !== 'complete') {
        setErrorMsg('Connection to server lost.')
        setStatus('error')
      }
      es.close()
    }
  }

  async function handleApprove(action: 'approve' | 'skip') {
    const directives = action === 'approve' ? pendingDirectives : []
    console.log(`[App] user action: ${action} | directives:`, directives)
    await fetch(`${API}/api/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, directives }),
    })
    console.log('[App] approve gate released, resuming loop')
    setPendingDirectives([])
    setRounds((prev) =>
      prev.map((r) => (r.status === 'awaiting_approval' ? { ...r, status: 'complete' } : r))
    )
    setStatus('running')
  }

  function toggleDirective(text: string) {
    setPendingDirectives((prev) =>
      prev.includes(text) ? prev.filter((d) => d !== text) : [...prev, text]
    )
  }

  function editDirective(oldText: string, newText: string) {
    setPendingDirectives((prev) =>
      prev.includes(oldText)
        ? prev.map((d) => (d === oldText ? newText : d))
        : prev
    )
  }

  function deleteDirective(text: string) {
    setPendingDirectives((prev) => prev.filter((d) => d !== text))
  }

  function addDirective(text: string) {
    setPendingDirectives((prev) => [...prev, text])
  }

  const isRunning = status === 'running' || status === 'awaiting_approval'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Multi-Agent Critique Loop
            </h1>
            <p className="text-xs text-gray-500">Powered by Perplexity Sonar Pro</p>
          </div>
          {status !== 'idle' && (
            <div className="ml-auto flex items-center gap-2">
              <StatusPill status={status} />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Config panel */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-200">Session Configuration</h2>

          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">
              Task
            </label>
            <textarea
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
              rows={3}
              value={config.task}
              onChange={(e) => setConfig((c) => ({ ...c, task: e.target.value }))}
              disabled={isRunning}
            />
          </div>

          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">
                Max Rounds
              </label>
              <input
                type="number"
                min={1}
                max={10}
                className="w-24 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
                value={config.max_rounds}
                onChange={(e) => setConfig((c) => ({ ...c, max_rounds: Number(e.target.value) }))}
                disabled={isRunning}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="auto_mode"
                type="checkbox"
                className="w-4 h-4 accent-indigo-500"
                checked={config.auto_mode}
                onChange={(e) => setConfig((c) => ({ ...c, auto_mode: e.target.checked }))}
                disabled={isRunning}
              />
              <label htmlFor="auto_mode" className="text-sm text-gray-300 select-none">
                Auto mode (skip approval gates)
              </label>
            </div>

            <button
              className="ml-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              onClick={handleStart}
              disabled={isRunning || !config.task.trim()}
            >
              {status === 'idle' || status === 'complete' || status === 'error'
                ? 'Start Session'
                : 'Running…'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-5 py-4 text-sm text-red-300">
            <span className="font-semibold text-red-400">Error: </span>
            {errorMsg}
          </div>
        )}

        {/* Round cards */}
        {rounds.map((round) => (
          <RoundCard
            key={round.round}
            round={round}
            totalAgents={config.agents}
            directiveControls={round.status === 'awaiting_approval' ? {
              pendingDirectives,
              onToggle: toggleDirective,
              onEdit: editDirective,
              onDelete: deleteDirective,
              onAdd: addDirective,
            } : undefined}
          />
        ))}

        {/* Action plan */}
        {actionPlan && <ActionPlanPanel plan={actionPlan} />}

        {/* Complete banner */}
        {status === 'complete' && (
          <div className="rounded-xl border border-green-800 bg-green-950/30 px-5 py-4 text-sm text-green-300 text-center font-medium">
            All {config.max_rounds} rounds complete. Session finished.
          </div>
        )}
      </main>

      {/* Approve bar — sticky at bottom */}
      {status === 'awaiting_approval' && (
        <div className="fixed bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-200">Round complete — review and edit directives above.</p>
              <p className="text-xs text-gray-500">
                {pendingDirectives.length} directive{pendingDirectives.length !== 1 ? 's' : ''} selected for next round.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="px-5 py-2 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium transition-colors"
                onClick={() => handleApprove('skip')}
              >
                Skip
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                onClick={() => handleApprove('approve')}
              >
                Approve &amp; Continue{pendingDirectives.length > 0 ? ` (${pendingDirectives.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer so last round isn't hidden behind approve bar */}
      {status === 'awaiting_approval' && <div className="h-24" />}
    </div>
  )
}

function StatusPill({ status }: { status: AppStatus }) {
  const styles: Record<AppStatus, string> = {
    idle: 'bg-gray-700 text-gray-300',
    running: 'bg-indigo-900/60 text-indigo-300',
    awaiting_approval: 'bg-yellow-900/60 text-yellow-300',
    complete: 'bg-green-900/60 text-green-300',
    error: 'bg-red-900/60 text-red-300',
  }
  const labels: Record<AppStatus, string> = {
    idle: 'Idle',
    running: 'Running',
    awaiting_approval: 'Awaiting approval',
    complete: 'Complete',
    error: 'Error',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
