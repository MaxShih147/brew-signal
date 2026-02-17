import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Tracked IPs</h1>
          <p className="text-sm text-stone-500 mt-1">
            Monitor IP trends to time BD/licensing negotiations for FamilyMart drip coffee collaborations.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-brew-600 text-white text-sm font-medium rounded-lg hover:bg-brew-700 transition-colors"
        >
          + Add IP
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-stone-700 mb-3">New IP</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="IP name (e.g. Chiikawa)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brew-400"
            />
            <textarea
              placeholder={"Aliases (one per line): alias, locale, weight\ne.g.\nChiikawa, en, 1.0\nちいかわ, jp, 1.2"}
              value={newAliases}
              onChange={e => setNewAliases(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brew-400"
            />
            {createStatus && (
              <div className="text-sm text-brew-600 flex items-center gap-2">
                {creating && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {createStatus}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-brew-600 text-white text-sm rounded-lg hover:bg-brew-700 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} disabled={creating} className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200 disabled:opacity-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : ips.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone-400">No IPs tracked yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ips.map(ip => (
            <Link
              key={ip.id}
              to={`/ips/${ip.id}`}
              className="bg-white rounded-xl border border-stone-200 p-4 hover:border-brew-300 hover:shadow-sm transition-all flex items-center gap-4 group"
            >
              <TrafficLight signal={ip.signal_light} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-800">{ip.name}</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {ip.aliases.map(a => a.alias).join(' / ')}
                </div>
              </div>
              <div className="text-right text-xs text-stone-400 shrink-0">
                {ip.last_updated
                  ? <>Last updated: {new Date(ip.last_updated).toLocaleDateString()}</>
                  : 'No data yet'}
              </div>
              <button
                onClick={(e) => handleDelete(e, ip.id, ip.name)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Delete IP"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
