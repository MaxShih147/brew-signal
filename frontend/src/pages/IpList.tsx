import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Loader2, Sparkles, ChevronRight } from 'lucide-react'
import { listIPs, createIP, deleteIP, discoverAliases } from '../api/client'
import type { IPItem } from '../types'
import TrafficLight from '../components/TrafficLight'

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
          {ips.map(ip => (
            <Link
              key={ip.id}
              to={`/ips/${ip.id}`}
              className="card flex items-center gap-4 group hover:border-brew-300 hover:shadow-md transition-all"
            >
              <TrafficLight signal={ip.signal_light} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-brew-900">{ip.name}</div>
                <div className="text-xs text-stone-400 mt-0.5 truncate">
                  {ip.aliases.map(a => a.alias).join(' / ')}
                </div>
              </div>
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
          ))}
        </div>
      )}
    </div>
  )
}
