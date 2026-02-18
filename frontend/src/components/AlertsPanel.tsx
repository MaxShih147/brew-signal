import { AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import type { Alert } from '../types'

interface Props {
  alerts: Alert[]
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string; icon: typeof Zap }> = {
  breakout: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'BREAKOUT', icon: TrendingUp },
  peak_turn: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'PEAK TURN', icon: AlertTriangle },
  spike: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'SPIKE', icon: Zap },
}

export default function AlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="card">
        <h2 className="card-header">Alerts</h2>
        <p className="text-sm text-stone-400">No active alerts.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="card-header">Alerts</h2>
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const config = TYPE_CONFIG[alert.type] || TYPE_CONFIG.spike
          const Icon = config.icon
          return (
            <div key={i} className={`${config.bg} border rounded-xl px-3 py-2.5`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}>
                  {config.label}
                </span>
                {alert.alert_date && (
                  <span className="text-[10px] text-stone-400 ml-auto">
                    {new Date(alert.alert_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${config.text}`}>{alert.message}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
