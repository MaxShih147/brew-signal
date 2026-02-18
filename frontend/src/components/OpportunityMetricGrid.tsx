import type { IndicatorResult } from '../types'

interface Props {
  indicators: IndicatorResult[]
  onSliderChange: (key: string, value: number) => void
}

const DIMENSION_ORDER = ['demand', 'diffusion', 'supply', 'gatekeeper', 'fit']
const DIMENSION_LABELS: Record<string, string> = {
  demand: 'Demand',
  diffusion: 'Diffusion',
  supply: 'Supply / Competition',
  gatekeeper: 'Gatekeeper',
  fit: 'Brand Fit',
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  LIVE: { bg: 'bg-blue-50', text: 'text-blue-600' },
  MANUAL: { bg: 'bg-amber-50', text: 'text-amber-600' },
  MISSING: { bg: 'bg-stone-100', text: 'text-stone-400' },
}

const SLIDER_KEYS = new Set([
  'social_buzz', 'video_momentum', 'cross_platform_presence',
  'ecommerce_density', 'fnb_collab_saturation', 'merch_pressure',
  'rightsholder_intensity', 'adult_fit', 'giftability', 'brand_aesthetic',
  'timing_window_override',
])

export default function OpportunityMetricGrid({ indicators, onSliderChange }: Props) {
  if (indicators.length === 0) return null

  const grouped: Record<string, IndicatorResult[]> = {}
  for (const ind of indicators) {
    if (!grouped[ind.dimension]) grouped[ind.dimension] = []
    grouped[ind.dimension].push(ind)
  }

  return (
    <div className="card">
      <h2 className="card-header">Indicators</h2>
      <div className="space-y-5">
        {DIMENSION_ORDER.map(dim => {
          const items = grouped[dim]
          if (!items || items.length === 0) return null
          return (
            <div key={dim}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                {DIMENSION_LABELS[dim] || dim}
              </h3>
              <div className="space-y-2">
                {items.map(ind => (
                  <IndicatorRow
                    key={ind.key}
                    indicator={ind}
                    isRisk={dim === 'supply'}
                    showSlider={SLIDER_KEYS.has(ind.key) || (ind.key === 'timing_window' && ind.status !== 'LIVE')}
                    onSliderChange={onSliderChange}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IndicatorRow({
  indicator,
  isRisk,
  showSlider,
  onSliderChange,
}: {
  indicator: IndicatorResult
  isRisk: boolean
  showSlider: boolean
  onSliderChange: (key: string, value: number) => void
}) {
  const { bg, text } = STATUS_BADGE[indicator.status] || STATUS_BADGE.MISSING
  const score = indicator.score_0_100

  const barColor = isRisk
    ? score > 60 ? 'bg-red-400' : score > 40 ? 'bg-amber-400' : 'bg-emerald-400'
    : score >= 60 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'

  const sliderKey = indicator.key === 'timing_window' ? 'timing_window_override' : indicator.key

  return (
    <div className="flex items-center gap-2">
      <span className={`pill ${bg} ${text} shrink-0`}>
        {indicator.status}
      </span>
      <span className="text-xs text-stone-600 w-36 shrink-0 truncate" title={indicator.label}>
        {indicator.label}
      </span>
      <div className="flex-1 h-1.5 bg-brew-50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-stone-500 w-7 text-right shrink-0">{score.toFixed(0)}</span>
      {showSlider ? (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={score / 100}
          onChange={(e) => onSliderChange(sliderKey, parseFloat(e.target.value))}
          className="w-20 shrink-0"
        />
      ) : (
        <div className="w-20 shrink-0" />
      )}
    </div>
  )
}
