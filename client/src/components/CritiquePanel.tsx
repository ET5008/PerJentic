import { useState } from 'react'
import type { CritiqueData } from '../types'
import DirectiveBadge from './DirectiveBadge'

export interface DirectiveControls {
  pendingDirectives: string[]
  onToggle: (text: string) => void
  onEdit: (oldText: string, newText: string) => void
  onDelete: (text: string) => void
  onAdd: (text: string) => void
}

interface CritiquePanelProps {
  critique: CritiqueData
  controls?: DirectiveControls
}

export default function CritiquePanel({ critique, controls }: CritiquePanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newValue, setNewValue] = useState('')

  const isInteractive = !!controls

  // All directives = original critic directives + any extras added by user
  const originalSet = new Set(critique.directives)
  const extraDirectives = controls
    ? controls.pendingDirectives.filter((d) => !originalSet.has(d))
    : []
  const allDirectives = [...critique.directives, ...extraDirectives]

  function startEdit(i: number, text: string) {
    setEditingIndex(i)
    setEditValue(text)
  }

  function commitEdit(text: string) {
    if (editValue.trim() && editValue.trim() !== text) {
      controls!.onEdit(text, editValue.trim())
    }
    setEditingIndex(null)
    setEditValue('')
  }

  function commitAdd() {
    if (newValue.trim()) {
      controls!.onAdd(newValue.trim())
    }
    setAddingNew(false)
    setNewValue('')
  }

  return (
    <div className="mt-6 border-t border-gray-700 pt-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Critic Synthesis
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{critique.cross_agent}</p>
      </div>

      {(allDirectives.length > 0 || isInteractive) && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {isInteractive ? 'Improvements for Next Round' : 'Improvement Directives for Next Round'}
          </h4>
          <div className="flex flex-col gap-2">
            {allDirectives.map((d, i) => {
              const isExtra = !originalSet.has(d)
              if (!isInteractive) {
                return <DirectiveBadge key={i} text={d} index={i} />
              }

              const isSelected = controls.pendingDirectives.includes(d)
              const isEditing = editingIndex === i

              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2 border transition-colors ${
                    isSelected
                      ? isExtra
                        ? 'bg-indigo-900/30 border-indigo-500/50'
                        : 'bg-amber-900/30 border-amber-500/40'
                      : 'bg-gray-800/40 border-gray-700/50 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-indigo-500 shrink-0 cursor-pointer"
                    checked={isSelected}
                    onChange={() => controls.onToggle(d)}
                  />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="w-full bg-gray-800 border border-indigo-500 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(d)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(d)
                          if (e.key === 'Escape') { setEditingIndex(null); setEditValue('') }
                        }}
                      />
                    ) : (
                      <span className="text-sm text-gray-200">
                        {isExtra && (
                          <span className="text-xs font-semibold text-indigo-400 uppercase mr-2">Custom</span>
                        )}
                        {d}
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="text-gray-600 hover:text-gray-300 transition-colors p-0.5"
                        title="Edit"
                        onClick={() => startEdit(i, d)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                        title="Remove"
                        onClick={() => controls.onDelete(d)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add new directive row */}
            {isInteractive && (
              addingNew ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    autoFocus
                    placeholder="New directive…"
                    className="flex-1 bg-gray-800 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none placeholder-gray-600"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onBlur={commitAdd}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAdd()
                      if (e.key === 'Escape') { setAddingNew(false); setNewValue('') }
                    }}
                  />
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={() => { setAddingNew(false); setNewValue('') }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 transition-colors mt-1 self-start"
                  onClick={() => setAddingNew(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add directive
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
