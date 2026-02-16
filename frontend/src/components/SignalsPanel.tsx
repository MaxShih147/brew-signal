import type { SignalsData } from '../types'
import TrafficLight from './TrafficLight'

interface Props {
  signals: SignalsData | null
  loading: boolean
}

export default function SignalsPanel({ signals, loading }: Props) {
  if (loading) {
    return <CardShell>Loading signals...</CardShell>
  }
  if (!signals) {
    return <CardShell>No signal data yet. Run a collection first.</CardShell>
  }

  const wowPct = signals.wow_growth !== null ? `${(signals.wow_growth * 100).toFixed(1)}%` : 'N/A'
  const wowOk = signals.wow_growth !== null && signals.wow_growth > 0.3
  const accOk = signals.acceleration === true
  const bpOk = signals.breakout_percentile !== null && signals.breakout_percentile >= 85

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-stone-800">BD Start Now?</h2>
        <TrafficLight signal={signals.signal_light} size="lg" />
        <span className="text-sm font-semibold uppercase" style={{
          color: signals.signal_light === 'green' ? '#10b981' : signals.signal_light === 'yellow' ? '#f59e0b' : '#ef4444'
        }}>
          {signals.signal_light || 'N/A'}
        </span>
      </div>

      <p className="text-xs text-stone-400 mb-4">
        Assuming 12-week licensing lead time. Green = start negotiation now.
      </p>

      <div className="space-y-3">
        <SignalRow
          label="WoW Growth"
          value={wowPct}
          threshold="> +30%"
          met={wowOk}
        />
        <SignalRow
          label="Acceleration"
          value={signals.acceleration !== null ? (signals.acceleration ? 'Yes' : 'No') : 'N/A'}
          threshold="2 consecutive weeks of rising WoW"
          met={accOk}
        />
        <SignalRow
          label="Breakout Percentile"
          value={signals.breakout_percentile !== null ? `P${signals.breakout_percentile.toFixed(0)}` : 'N/A'}
          threshold=">= P85 of 6-month range"
          met={bpOk}
        />
      </div>
    </div>
  )
}

function SignalRow({ label, value, threshold, met }: { label: string; value: string; threshold: string; met: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${met ? 'bg-emerald-400' : 'bg-stone-300'}`} />
      <div className="flex-1">
        <div className="text-sm font-medium text-stone-700">{label}: <span className="font-semibold">{value}</span></div>
        <div className="text-xs text-stone-400">Threshold: {threshold}</div>
      </div>
    </div>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">BD Start Now?</h2>
      <p className="text-sm text-stone-400">{children}</p>
    </div>
  )
}
