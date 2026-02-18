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
  LIVE: { bg: 'bg-blue-100', text: 'text-blue-700' },
  MANUAL: { bg: 'bg-amber-100', text: 'text-amber-700' },
  MISSING: { bg: 'bg-stone-100', text: 'text-stone-500' },
}

// Indicators that allow slider input
const SLIDER_KEYS = new Set([
  'social_buzz', 'video_momentum', 'cross_platform_presence',
  'ecommerce_density', 'fnb_collab_saturation', 'merch_pressure',
  'rightsholder_intensity', 'adult_fit', 'giftability', 'brand_aesthetic',
  'timing_window_override',
])

export default function OpportunityMetricGrid({ indicators, onSliderChange }: Props) {
  if (indicators.length === 0) {
    return null
  }

  const grouped: Record<string, IndicatorResult[]> = {}
  for (const ind of indicators) {
    if (!grouped[ind.dimension]) grouped[ind.dimension] = []
    grouped[ind.dimension].push(ind)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Indicator Grid</h2>
      <div className="space-y-5">
        {DIMENSION_ORDER.map(dim => {
          const items = grouped[dim]
          if (!items || items.length === 0) return null
          return (
            <div key={dim}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
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

  // For slider, use the indicator key; timing_window uses timing_window_override
  const sliderKey = indicator.key === 'timing_window' ? 'timing_window_override' : indicator.key

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${bg} ${text} flex-shrink-0`}>
        {indicator.status}
      </span>
      <span className="text-xs text-stone-700 w-36 flex-shrink-0 truncate" title={indicator.label}>
        {indicator.label}
      </span>
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-stone-500 w-7 text-right flex-shrink-0">{score.toFixed(0)}</span>
      {showSlider ? (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={score / 100}
          onChange={(e) => onSliderChange(sliderKey, parseFloat(e.target.value))}
          className="w-20 flex-shrink-0 accent-brew-600"
        />
      ) : (
        <div className="w-20 flex-shrink-0" />
      )}
    </div>
  )
}
