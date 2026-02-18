import type { OpportunityData } from '../types'
import TrafficLight from './TrafficLight'
import ConfidenceBadge from './ConfidenceBadge'

interface Props {
  data: OpportunityData | null
  loading: boolean
}

const DIMENSION_BARS: { key: keyof OpportunityData; label: string; risk?: boolean }[] = [
  { key: 'demand_score', label: 'Demand' },
  { key: 'diffusion_score', label: 'Diffusion' },
  { key: 'fit_score', label: 'Fit' },
  { key: 'supply_risk', label: 'Supply Risk', risk: true },
  { key: 'gatekeeper_risk', label: 'Gatekeeper', risk: true },
  { key: 'timing_score', label: 'Timing' },
]

export default function OpportunityScoreCard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800 mb-2">Opportunity Score</h2>
        <p className="text-sm text-stone-400">Loading opportunity data...</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800 mb-2">Opportunity Score</h2>
        <p className="text-sm text-stone-400">No opportunity data yet. Run a collection first.</p>
      </div>
    )
  }

  const scoreColor =
    data.opportunity_light === 'green'
      ? 'text-emerald-500'
      : data.opportunity_light === 'yellow'
        ? 'text-amber-500'
        : 'text-red-500'

  const badgeColor =
    data.opportunity_light === 'green'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : data.opportunity_light === 'yellow'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200'

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold text-stone-800">Opportunity Score</h2>
        <TrafficLight signal={data.opportunity_light} size="lg" />
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
          {data.opportunity_light === 'green' ? 'GO' : data.opportunity_light === 'yellow' ? 'WATCH' : 'WAIT'}
        </span>
        <div className="ml-auto">
          <ConfidenceBadge confidence={data.confidence} size="md" />
        </div>
      </div>

      {/* Big score */}
      <div className={`text-3xl font-bold ${scoreColor} mb-1`}>
        {data.opportunity_score.toFixed(0)}
        <span className="text-base font-normal text-stone-400"> / 100</span>
      </div>

      {/* Score breakdown */}
      <p className="text-xs text-stone-400 mb-4 font-mono">
        Base: {data.base_score.toFixed(1)} &times; Timing: {data.timing_multiplier.toFixed(2)} &times; Risk: {data.risk_multiplier.toFixed(2)} = {data.opportunity_score.toFixed(1)}
      </p>

      {/* Coverage banner */}
      {data.coverage_ratio < 0.4 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs font-semibold text-amber-700">
            LOW CONFIDENCE — most indicators are manual estimates ({(data.coverage_ratio * 100).toFixed(0)}% live data)
          </p>
        </div>
      )}

      {/* Dimension bars */}
      <div className="space-y-2 mb-4">
        {DIMENSION_BARS.map(({ key, label, risk }) => {
          const value = data[key] as number
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-stone-500 w-20 flex-shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    risk
                      ? value > 60 ? 'bg-red-400' : value > 40 ? 'bg-amber-400' : 'bg-emerald-400'
                      : value >= 60 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-xs text-stone-500 w-8 text-right">{value.toFixed(0)}</span>
            </div>
          )
        })}
      </div>

      {/* Explanations */}
      {data.explanations.length > 0 && (
        <div className="border-t border-stone-100 pt-3">
          <ul className="space-y-1">
            {data.explanations.map((exp, i) => (
              <li key={i} className="text-xs text-stone-600 flex gap-1.5">
                <span className="text-stone-400">&bull;</span>
                {exp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
