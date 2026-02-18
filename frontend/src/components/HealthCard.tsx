import type { HealthData } from '../types'

interface Props {
  health: HealthData | null
  loading: boolean
}

export default function HealthCard({ health, loading }: Props) {
  if (loading) return <CardShell>Loading health data...</CardShell>
  if (!health) return <CardShell>No health data available</CardShell>

  const statusColor = health.last_run_status === 'success' ? 'text-emerald-600' : 'text-red-500'

  return (
    <div className="card">
      <h2 className="card-header">Data Source</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Source" value={health.source} />
        <Stat label="Last Run" value={health.last_run_status || 'N/A'} valueClass={statusColor} />
        <Stat label="Last Success" value={health.last_success_time ? new Date(health.last_success_time).toLocaleString() : 'Never'} />
        <Stat label="14d Success Rate" value={health.success_rate_14d !== null ? `${health.success_rate_14d}%` : 'N/A'} />
        <Stat label="Total Runs (14d)" value={String(health.total_runs_14d)} />
      </div>

      {Object.keys(health.error_breakdown).length > 0 && (
        <div className="mt-3 pt-3 border-t border-brew-100">
          <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">Errors (14d)</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(health.error_breakdown).map(([code, count]) => (
              <span key={code} className="pill bg-red-50 text-red-600">
                {code}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {health.anomaly_flags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-brew-100">
          <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">Anomalies</div>
          <div className="flex flex-wrap gap-1.5">
            {health.anomaly_flags.map(flag => (
              <span key={flag} className="pill bg-amber-50 text-amber-700">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, valueClass = 'text-stone-800' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className={`font-medium text-sm ${valueClass}`}>{value}</div>
    </div>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="card-header">Data Source</h2>
      <p className="text-sm text-stone-400">{children}</p>
    </div>
  )
}
