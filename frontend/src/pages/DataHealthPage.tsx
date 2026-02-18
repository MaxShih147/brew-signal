import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSourceHealth, getSourceRegistry, getCoverageMatrix, getSourceRuns } from '../api/client'
import type { SourceHealthData, SourceRegistryData, CoverageMatrixRow, SourceRunData } from '../types'

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  ok: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  warn: { bg: 'bg-amber-100', text: 'text-amber-700' },
  down: { bg: 'bg-red-100', text: 'text-red-700' },
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
    return <div className="py-12 text-center text-stone-400">Loading data health...</div>
  }

  const sourceKeys = registry.map(r => r.source_key)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ips" className="text-brew-600 hover:text-brew-700 text-sm">&larr; IPs</Link>
        <h1 className="text-2xl font-bold text-stone-800">Data Health</h1>
      </div>

      {/* A) Source Risk Overview */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-800 mb-3">Source Risk Registry</h2>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Source</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Availability</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Risk Type</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-stone-500">Key</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Weight</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {registry.map(r => (
                <tr key={r.source_key} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{r.source_key}</td>
                  <td className="px-4 py-2">
                    <AvailabilityPill level={r.availability_level} />
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-600">{r.risk_type}</td>
                  <td className="px-4 py-2 text-center">{r.is_key_source ? '***' : ''}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{r.priority_weight.toFixed(1)}</td>
                  <td className="px-4 py-2 text-xs text-stone-400 max-w-xs truncate">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* B) Source Health Table */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-800 mb-3">Source Health</h2>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Source</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Status</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">24h Rate</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">7d Rate</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Coverage</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Last Success</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Last Error</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => {
                const pill = STATUS_PILL[s.status] || STATUS_PILL.down
                return (
                  <tr key={s.source_key} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{s.source_key}</td>
                    <td className="px-4 py-2">
                      <span className={`${pill.bg} ${pill.text} text-[10px] font-bold uppercase px-2 py-0.5 rounded`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {s.success_rate_24h !== null ? `${(s.success_rate_24h * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {s.success_rate_7d !== null ? `${(s.success_rate_7d * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {s.coverage}/{s.total_ips}
                    </td>
                    <td className="px-4 py-2 text-xs text-stone-500">
                      {s.last_success_at ? new Date(s.last_success_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-xs truncate">
                      {s.last_error || '-'}
                    </td>
                  </tr>
                )
              })}
              {sources.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-400">No source data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* C) Coverage Matrix */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-stone-800">Coverage Matrix</h2>
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            <input
              type="checkbox"
              checked={onlyIssues}
              onChange={e => setOnlyIssues(e.target.checked)}
              className="accent-brew-600"
            />
            Issues only
          </label>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500 sticky left-0 bg-stone-50">IP</th>
                {sourceKeys.map(sk => (
                  <th key={sk} className="text-center px-3 py-2 text-xs font-semibold text-stone-500">{sk}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => (
                <tr key={row.ip_id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2 text-xs font-medium text-stone-700 sticky left-0 bg-white">
                    <Link to={`/ips/${row.ip_id}`} className="text-brew-600 hover:underline">{row.ip_name}</Link>
                  </td>
                  {sourceKeys.map(sk => {
                    const cell = row.sources.find(s => s.source_key === sk)
                    const status = cell?.status || 'down'
                    const pill = STATUS_PILL[status] || STATUS_PILL.down
                    return (
                      <td key={sk} className="px-3 py-2 text-center" title={cell?.last_error || ''}>
                        <span className={`${pill.bg} ${pill.text} text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}>
                          {status}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {matrix.length === 0 && (
                <tr><td colSpan={sourceKeys.length + 1} className="px-4 py-6 text-center text-stone-400">No IPs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* D) Recent Runs */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-stone-800">Recent Runs</h2>
          <select
            value={runFilter}
            onChange={e => { setRunFilter(e.target.value); }}
            className="text-xs border border-stone-200 rounded px-2 py-1"
          >
            <option value="">All sources</option>
            {sourceKeys.map(sk => <option key={sk} value={sk}>{sk}</option>)}
          </select>
          <button onClick={loadRuns} className="text-xs text-brew-600 hover:underline">Refresh</button>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Source</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Started</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Status</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">Duration</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-stone-500">OK/Fail</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const pill = STATUS_PILL[r.status] || STATUS_PILL.down
                return (
                  <tr key={r.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{r.source_key}</td>
                    <td className="px-4 py-2 text-xs text-stone-500">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`${pill.bg} ${pill.text} text-[10px] font-bold uppercase px-2 py-0.5 rounded`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {r.duration_ms ? `${r.duration_ms}ms` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {r.items_succeeded}/{r.items_failed}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-xs truncate">
                      {r.error_sample || '-'}
                    </td>
                  </tr>
                )
              })}
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">No runs recorded yet.</td></tr>
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
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`${styles[level] || styles.low} text-[10px] font-bold uppercase px-2 py-0.5 rounded`}>
      {level}
    </span>
  )
}
