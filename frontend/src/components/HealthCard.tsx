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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Data Source Health</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Source" value={health.source} />
        <Stat label="Last Run" value={health.last_run_status || 'N/A'} valueClass={statusColor} />
        <Stat label="Last Success" value={health.last_success_time ? new Date(health.last_success_time).toLocaleString() : 'Never'} />
        <Stat label="14d Success Rate" value={health.success_rate_14d !== null ? `${health.success_rate_14d}%` : 'N/A'} />
        <Stat label="Total Runs (14d)" value={String(health.total_runs_14d)} />
      </div>

      {Object.keys(health.error_breakdown).length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Error Breakdown (14d)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(health.error_breakdown).map(([code, count]) => (
              <span key={code} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                {code}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {health.anomaly_flags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Anomaly Flags</div>
          <div className="flex flex-wrap gap-2">
            {health.anomaly_flags.map(flag => (
              <span key={flag} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
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
      <div className="text-xs text-stone-400">{label}</div>
      <div className={`font-medium ${valueClass}`}>{value}</div>
    </div>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Data Source Health</h2>
      <p className="text-sm text-stone-400">{children}</p>
    </div>
  )
}
