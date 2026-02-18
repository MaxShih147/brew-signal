import { useState } from 'react'
import type { ConfidenceData } from '../types'

interface Props {
  confidence: ConfidenceData | null
  size?: 'sm' | 'md'
}

const BAND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-700', label: 'HIGH' },
  medium: { bg: 'bg-amber-100 border-amber-200', text: 'text-amber-700', label: 'MED' },
  low: { bg: 'bg-red-100 border-red-200', text: 'text-red-700', label: 'LOW' },
  insufficient: { bg: 'bg-stone-100 border-stone-200', text: 'text-stone-500', label: 'INSUF' },
}

export default function ConfidenceBadge({ confidence, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)

  if (!confidence) return null

  const style = BAND_STYLES[confidence.confidence_band] || BAND_STYLES.insufficient
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]'

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`${style.bg} ${style.text} ${textSize} font-bold uppercase px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity`}
        title={`Data Confidence: ${confidence.confidence_score}%`}
      >
        {style.label} {confidence.confidence_score}%
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-lg shadow-lg border border-stone-200 p-3 w-64">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-stone-700">Data Confidence</span>
              <span className={`text-lg font-bold ${style.text}`}>{confidence.confidence_score}%</span>
            </div>

            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Indicators</span>
                <span className="font-mono">{confidence.active_indicators} / {confidence.total_indicators}</span>
              </div>
              <div className="flex justify-between">
                <span>Sources</span>
                <span className="font-mono">{confidence.active_sources} / {confidence.expected_sources}</span>
              </div>
              {confidence.last_calculated_at && (
                <div className="flex justify-between">
                  <span>Last updated</span>
                  <Staleness timestamp={confidence.last_calculated_at} />
                </div>
              )}
            </div>

            {confidence.missing_sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-100">
                <span className="text-[10px] font-semibold text-stone-400 uppercase">Missing sources</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {confidence.missing_sources.map(s => (
                    <span key={s} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {confidence.missing_indicators.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-100">
                <span className="text-[10px] font-semibold text-stone-400 uppercase">Missing indicators</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {confidence.missing_indicators.map(i => (
                    <span key={i} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{i}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Staleness({ timestamp }: { timestamp: string }) {
  const age = Date.now() - new Date(timestamp).getTime()
  const hours = Math.floor(age / (1000 * 60 * 60))
  let label: string
  let color: string
  if (hours < 24) {
    label = `${hours}h ago`
    color = 'text-emerald-600'
  } else if (hours < 72) {
    label = `${Math.floor(hours / 24)}d ago`
    color = 'text-amber-600'
  } else {
    label = `${Math.floor(hours / 24)}d ago`
    color = 'text-red-600'
  }
  return <span className={`font-mono ${color}`}>{label}</span>
}
