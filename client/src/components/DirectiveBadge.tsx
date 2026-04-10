interface DirectiveBadgeProps {
  text: string
  index: number
}

const COLORS = [
  'bg-amber-900/40 border border-amber-500/50 text-amber-200',
  'bg-purple-900/40 border border-purple-500/50 text-purple-200',
  'bg-cyan-900/40 border border-cyan-500/50 text-cyan-200',
]

export default function DirectiveBadge({ text, index }: DirectiveBadgeProps) {
  const color = COLORS[index % COLORS.length]
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${color}`}>
      <span className="font-semibold mr-2">Directive {index + 1}:</span>
      {text}
    </div>
  )
}
