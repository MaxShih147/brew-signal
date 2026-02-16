import type { Alert } from '../types'

interface Props {
  alerts: Alert[]
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  breakout: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'BREAKOUT' },
  peak_turn: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'PEAK TURN' },
  spike: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'SPIKE' },
}

export default function AlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800 mb-2">Alerts</h2>
        <p className="text-sm text-stone-400">No active alerts.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-3">Alerts</h2>
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const style = TYPE_STYLES[alert.type] || TYPE_STYLES.spike
          return (
            <div key={i} className={`${style.bg} border rounded-lg px-3 py-2`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
                  {style.label}
                </span>
                {alert.alert_date && (
                  <span className="text-[10px] text-stone-400">
                    {new Date(alert.alert_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-0.5 ${style.text}`}>{alert.message}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
