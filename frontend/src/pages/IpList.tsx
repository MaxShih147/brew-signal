import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Loader2, Sparkles, ChevronRight } from 'lucide-react'
import { listIPs, createIP, deleteIP, discoverAliases } from '../api/client'
import type { IPItem } from '../types'

const DECISION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  START: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'START' },
  MONITOR: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'MONITOR' },
  REJECT: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'REJECT' },
}

const STAGE_STYLES: Record<string, string> = {
  negotiating: 'bg-blue-50 text-blue-700 border-blue-200',
  secured: 'bg-violet-50 text-violet-700 border-violet-200',
  launched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archived: 'bg-stone-100 text-stone-500 border-stone-200',
}

export default function IpList() {
  const [ips, setIPs] = useState<IPItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAliases, setNewAliases] = useState('')
  const [creating, setCreating] = useState(false)
  const [createStatus, setCreateStatus] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      setIPs(await listIPs())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim() || creating) return
    const aliases = newAliases
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [alias, locale = 'en', weight = '1.0'] = line.split(',').map(s => s.trim())
        return { alias, locale, weight: parseFloat(weight) || 1.0 }
      })
    setCreating(true)
    setCreateStatus('Creating IP...')
    try {
      const ip = await createIP(newName.trim(), aliases)
      setCreateStatus('Discovering aliases via Claude AI...')
      try {
        await discoverAliases(ip.id, true)
      } catch {
        // Discovery is best-effort; continue even if it fails
      }
      setNewName('')
      setNewAliases('')
      setShowCreate(false)
      setCreateStatus(null)
      navigate(`/ips/${ip.id}`)
    } catch (err: any) {
      setCreateStatus(`Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}" and all its data?`)) return
    await deleteIP(id)
    load()
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brew-900">IP Candidates</h1>
          <p className="text-sm text-stone-500 mt-1">
            Track and evaluate IPs for FamilyMart drip coffee licensing.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add IP
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="card-header">New IP</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="IP name (e.g. Chiikawa)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="input-field"
            />
            <textarea
              placeholder={"Aliases (one per line): alias, locale, weight\ne.g.\nChiikawa, en, 1.0\nちいかわ, jp, 1.2"}
              value={newAliases}
              onChange={e => setNewAliases(e.target.value)}
              rows={4}
              className="input-field font-mono text-xs"
            />
            {createStatus && (
              <div className="text-sm text-brew-600 flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating && createStatus.includes('Discovering') && <Sparkles className="w-4 h-4" />}
                {createStatus}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating} className="btn-primary disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} disabled={creating} className="btn-ghost disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IP list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading candidates...</span>
        </div>
      ) : ips.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-400">No IPs tracked yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ips.map(ip => {
            const decision = ip.bd_decision ? DECISION_STYLES[ip.bd_decision] : null
            const stageStyle = ip.pipeline_stage && ip.pipeline_stage !== 'candidate'
              ? STAGE_STYLES[ip.pipeline_stage]
              : null

            return (
              <Link
                key={ip.id}
                to={`/ips/${ip.id}`}
                className="card flex items-center gap-4 group hover:border-brew-300 hover:shadow-md transition-all"
              >
                {/* BD Decision badge or unscored dot */}
                <div className="w-20 shrink-0 flex flex-col items-center gap-1">
                  {decision ? (
                    <>
                      <span className={`pill border ${decision.bg} ${decision.text} ${decision.border}`}>
                        {decision.label}
                      </span>
                      <span className={`text-lg font-bold ${
                        ip.bd_decision === 'START' ? 'text-emerald-600' :
                        ip.bd_decision === 'MONITOR' ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {ip.bd_score?.toFixed(0) ?? '—'}
                      </span>
                    </>
                  ) : (
                    <span className="pill border bg-stone-50 text-stone-400 border-stone-200">—</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-brew-900">{ip.name}</span>
                    {stageStyle && (
                      <span className={`pill border ${stageStyle}`}>
                        {ip.pipeline_stage}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5 truncate">
                    {ip.aliases.map(a => a.alias).join(' / ')}
                  </div>
                </div>

                {/* Confidence */}
                {ip.confidence_score != null && (
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      ip.confidence_score >= 70 ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                      ip.confidence_score >= 40 ? 'bg-amber-100 border-amber-200 text-amber-700' :
                      'bg-stone-100 border-stone-200 text-stone-500'
                    }`}>
                      {ip.confidence_score}%
                    </span>
                  </div>
                )}

                <div className="text-right text-xs text-stone-400 shrink-0">
                  {ip.last_updated
                    ? new Date(ip.last_updated).toLocaleDateString()
                    : 'No data yet'}
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brew-500 transition-colors shrink-0" />
                <button
                  onClick={(e) => handleDelete(e, ip.id, ip.name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                  title="Delete IP"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
