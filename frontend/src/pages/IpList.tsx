import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listIPs, createIP } from '../api/client'
import type { IPItem } from '../types'
import TrafficLight from '../components/TrafficLight'

export default function IpList() {
  const [ips, setIPs] = useState<IPItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAliases, setNewAliases] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await listIPs()
      setIPs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const aliases = newAliases
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [alias, locale = 'en', weight = '1.0'] = line.split(',').map(s => s.trim())
        return { alias, locale, weight: parseFloat(weight) || 1.0 }
      })
    await createIP(newName.trim(), aliases)
    setNewName('')
    setNewAliases('')
    setShowCreate(false)
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brew-400"
            />
            <textarea
              placeholder={"Aliases (one per line): alias, locale, weight\ne.g.\nChiikawa, en, 1.0\nちいかわ, jp, 1.2"}
              value={newAliases}
              onChange={e => setNewAliases(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brew-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-brew-600 text-white text-sm rounded-lg hover:bg-brew-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-stone-100 text-stone-600 text-sm rounded-lg hover:bg-stone-200"
              >
                Cancel
              </button>
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
              className="bg-white rounded-xl border border-stone-200 p-4 hover:border-brew-300 hover:shadow-sm transition-all flex items-center gap-4"
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
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
