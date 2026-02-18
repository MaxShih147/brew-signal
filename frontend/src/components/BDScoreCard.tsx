import { ShieldCheck, ShieldX } from 'lucide-react'
import type { BDScoreData } from '../types'
import ConfidenceBadge from './ConfidenceBadge'

interface Props {
  data: BDScoreData | null
  loading: boolean
}

const DECISION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  START: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  MONITOR: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  REJECT: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const DIMENSION_BARS: { key: keyof BDScoreData; label: string; weight: string }[] = [
  { key: 'timing_urgency', label: 'Timing Urgency', weight: '0.35' },
  { key: 'demand_trajectory', label: 'Demand Trajectory', weight: '0.30' },
  { key: 'market_gap', label: 'Market Gap', weight: '0.20' },
  { key: 'feasibility', label: 'Feasibility', weight: '0.15' },
]

export default function BDScoreCard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="card">
        <h2 className="card-header">BD Score</h2>
        <p className="text-sm text-stone-400">Loading BD allocation data...</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <h2 className="card-header">BD Score</h2>
        <p className="text-sm text-stone-400">No BD score data yet. Run a collection first.</p>
      </div>
    )
  }

  const dStyle = DECISION_STYLES[data.bd_decision] || DECISION_STYLES.REJECT
  const scoreColor =
    data.bd_decision === 'START'
      ? 'text-emerald-500'
      : data.bd_decision === 'MONITOR'
        ? 'text-amber-500'
        : 'text-red-500'

  return (
    <div className="card">
      {/* Header: Decision badge + score + confidence */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="card-header mb-0">BD Score</h2>
        <span className={`pill border ${dStyle.bg} ${dStyle.text} ${dStyle.border}`}>
          {data.bd_decision}
        </span>
        <div className="ml-auto">
          <ConfidenceBadge confidence={data.confidence} size="md" />
        </div>
      </div>

      {/* Big score */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-4xl font-bold ${scoreColor}`}>
          {data.bd_score.toFixed(0)}
        </span>
        <span className="text-sm text-stone-400">/ 100</span>
      </div>

      {/* Score breakdown */}
      <p className="text-xs text-stone-400 mb-4 font-mono">
        Raw {data.raw_score.toFixed(1)} &times; Confidence {data.confidence_multiplier.toFixed(2)} = {data.bd_score.toFixed(1)}
      </p>

      {/* Fit Gate */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 border ${
        data.fit_gate_passed
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-red-50/70 border-red-200'
      }`}>
        {data.fit_gate_passed
          ? <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          : <ShieldX className="w-4 h-4 text-red-600 shrink-0" />
        }
        <span className={`text-xs font-semibold ${data.fit_gate_passed ? 'text-emerald-700' : 'text-red-700'}`}>
          Fit Gate: {data.fit_gate_passed ? 'PASS' : 'FAIL'} ({data.fit_gate_score.toFixed(0)})
        </span>
        <span className="text-[10px] text-stone-400 ml-auto">
          min(adult_fit, giftability, brand_aesthetic)
        </span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2.5 mb-5">
        {DIMENSION_BARS.map(({ key, label, weight }) => {
          const value = data[key] as number
          const barColor =
            value >= 65 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400'
          return (
            <div key={key}>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-stone-500 w-32 shrink-0">
                  {label}
                  <span className="text-[10px] text-stone-300 ml-1">({weight})</span>
                </span>
                <div className="flex-1 h-2 bg-brew-50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-stone-500 w-8 text-right">{value.toFixed(0)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Explanations */}
      {data.explanations.length > 0 && (
        <div className="border-t border-brew-100 pt-3">
          <ul className="space-y-1.5">
            {data.explanations.map((exp, i) => (
              <li key={i} className="text-xs text-stone-600 flex gap-2">
                <span className="text-brew-400 mt-0.5">&#9656;</span>
                {exp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
