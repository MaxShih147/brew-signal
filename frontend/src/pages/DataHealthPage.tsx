import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { getSourceHealth, getSourceRegistry, getCoverageMatrix, getSourceRuns } from '../api/client'
import type { SourceHealthData, SourceRegistryData, CoverageMatrixRow, SourceRunData } from '../types'

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  ok: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warn: { bg: 'bg-amber-50', text: 'text-amber-700' },
  down: { bg: 'bg-red-50', text: 'text-red-700' },
}

export default function DataHealthPage() {
  const [sources, setSources] = useState<SourceHealthData[]>([])
  const [registry, setRegistry] = useState<SourceRegistryData[]>([])
  const [matrix, setMatrix] = useState<CoverageMatrixRow[]>([])
  const [runs, setRuns] = useState<SourceRunData[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [runFilter, setRunFilter] = useState<string>('')

  useEffect(() => {
    loadAll()
  }, [onlyIssues])

  const loadAll = async () => {
    setLoading(true)
    const [s, r, m, ru] = await Promise.allSettled([
      getSourceHealth(),
      getSourceRegistry(),
      getCoverageMatrix(50, onlyIssues),
      getSourceRuns(runFilter || undefined, 30),
    ])
    if (s.status === 'fulfilled') setSources(s.value)
    if (r.status === 'fulfilled') setRegistry(r.value)
    if (m.status === 'fulfilled') setMatrix(m.value)
    if (ru.status === 'fulfilled') setRuns(ru.value)
    setLoading(false)
  }

  const loadRuns = async () => {
    const result = await getSourceRuns(runFilter || undefined, 30)
    setRuns(result)
  }

  if (loading) {
    return <div className="py-12 text-center text-stone-400 text-sm">Loading data health...</div>
  }

  const sourceKeys = registry.map(r => r.source_key)

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link to="/ips" className="text-brew-600 hover:text-brew-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-brew-900">Data Health</h1>
      </div>

      {/* A) Source Risk Overview */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-brew-900 mb-3">Source Risk Registry</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brew-50/50 border-b border-brew-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Availability</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Risk Type</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Key</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Weight</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {registry.map(r => (
                <tr key={r.source_key} className="border-b border-brew-50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{r.source_key}</td>
                  <td className="px-4 py-2.5"><AvailabilityPill level={r.availability_level} /></td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{r.risk_type}</td>
                  <td className="px-4 py-2.5 text-center text-xs">{r.is_key_source ? '***' : ''}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">{r.priority_weight.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-400 max-w-xs truncate">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* B) Source Health Table */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-brew-900 mb-3">Source Health</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brew-50/50 border-b border-brew-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">24h</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">7d</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Coverage</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Last Success</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => {
                const pill = STATUS_PILL[s.status] || STATUS_PILL.down
                return (
                  <tr key={s.source_key} className="border-b border-brew-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{s.source_key}</td>
                    <td className="px-4 py-2.5">
                      <span className={`pill ${pill.bg} ${pill.text}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">
                      {s.success_rate_24h !== null ? `${(s.success_rate_24h * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">
                      {s.success_rate_7d !== null ? `${(s.success_rate_7d * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">
                      {s.coverage}/{s.total_ips}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-stone-500">
                      {s.last_success_at ? new Date(s.last_success_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-red-500 max-w-xs truncate">{s.last_error || '-'}</td>
                  </tr>
                )
              })}
              {sources.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400 text-sm">No source data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* C) Coverage Matrix */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold text-brew-900">Coverage Matrix</h2>
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} className="accent-brew-600 rounded" />
            Issues only
          </label>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brew-50/50 border-b border-brew-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider sticky left-0 bg-brew-50/80 backdrop-blur-sm">IP</th>
                {sourceKeys.map(sk => (
                  <th key={sk} className="text-center px-3 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{sk}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => (
                <tr key={row.ip_id} className="border-b border-brew-50 last:border-0">
                  <td className="px-4 py-2.5 text-xs font-medium sticky left-0 bg-white/80 backdrop-blur-sm">
                    <Link to={`/ips/${row.ip_id}`} className="text-brew-600 hover:underline">{row.ip_name}</Link>
                  </td>
                  {sourceKeys.map(sk => {
                    const cell = row.sources.find(s => s.source_key === sk)
                    const status = cell?.status || 'down'
                    const pill = STATUS_PILL[status] || STATUS_PILL.down
                    return (
                      <td key={sk} className="px-3 py-2.5 text-center" title={cell?.last_error || ''}>
                        <span className={`pill ${pill.bg} ${pill.text}`}>{status}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {matrix.length === 0 && (
                <tr><td colSpan={sourceKeys.length + 1} className="px-4 py-8 text-center text-stone-400 text-sm">No IPs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* D) Recent Runs */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold text-brew-900">Recent Runs</h2>
          <select
            value={runFilter}
            onChange={e => setRunFilter(e.target.value)}
            className="text-xs border border-brew-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brew-300"
          >
            <option value="">All sources</option>
            {sourceKeys.map(sk => <option key={sk} value={sk}>{sk}</option>)}
          </select>
          <button onClick={loadRuns} className="flex items-center gap-1 text-xs text-brew-600 hover:text-brew-700 transition-colors">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brew-50/50 border-b border-brew-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Started</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Duration</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">OK/Fail</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const pill = STATUS_PILL[r.status] || STATUS_PILL.down
                return (
                  <tr key={r.id} className="border-b border-brew-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-700">{r.source_key}</td>
                    <td className="px-4 py-2.5 text-xs text-stone-500">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`pill ${pill.bg} ${pill.text}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">
                      {r.duration_ms ? `${r.duration_ms}ms` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-600">
                      {r.items_succeeded}/{r.items_failed}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-red-500 max-w-xs truncate">{r.error_sample || '-'}</td>
                  </tr>
                )
              })}
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400 text-sm">No runs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AvailabilityPill({ level }: { level: string }) {
  const styles: Record<string, string> = {
    high: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`pill ${styles[level] || styles.low}`}>{level}</span>
  )
}
