import { useState } from 'react'
import type { IPDetail, Alias } from '../types'
import { addAlias, updateAlias } from '../api/client'

interface Props {
  ip: IPDetail
  geo: string
  timeframe: string
  onGeoChange: (g: string) => void
  onTimeframeChange: (t: string) => void
  onRefresh: () => void
}

const GEOS = ['TW', 'JP', 'US', 'WW']
const TIMEFRAMES = ['90d', '12m', '5y']

export default function IpConfigCard({ ip, geo, timeframe, onGeoChange, onTimeframeChange, onRefresh }: Props) {
  const [adding, setAdding] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [newLocale, setNewLocale] = useState('en')
  const [newWeight, setNewWeight] = useState('1.0')

  const handleAdd = async () => {
    if (!newAlias.trim()) return
    await addAlias(ip.id, { alias: newAlias.trim(), locale: newLocale, weight: parseFloat(newWeight) || 1.0 })
    setNewAlias('')
    setAdding(false)
    onRefresh()
  }

  const toggleAlias = async (a: Alias) => {
    await updateAlias(a.id, { enabled: !a.enabled })
    onRefresh()
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">IP Configuration</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Primary Name</label>
          <div className="text-stone-800 font-medium">{ip.name}</div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Aliases</label>
          <div className="space-y-1.5">
            {ip.aliases.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => toggleAlias(a)}
                  className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                    a.enabled ? 'bg-brew-600 border-brew-600 text-white' : 'border-stone-300'
                  }`}
                >
                  {a.enabled && '✓'}
                </button>
                <span className={a.enabled ? 'text-stone-800' : 'text-stone-400 line-through'}>{a.alias}</span>
                <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{a.locale}</span>
                <span className="text-xs text-stone-400">w={a.weight}</span>
              </div>
            ))}
          </div>
          {adding ? (
            <div className="mt-2 flex gap-2 items-end">
              <input value={newAlias} onChange={e => setNewAlias(e.target.value)} placeholder="Alias" className="px-2 py-1 border border-stone-300 rounded text-sm w-32" />
              <select value={newLocale} onChange={e => setNewLocale(e.target.value)} className="px-2 py-1 border border-stone-300 rounded text-sm">
                <option>en</option><option>zh</option><option>jp</option><option>other</option>
              </select>
              <input value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="1.0" className="px-2 py-1 border border-stone-300 rounded text-sm w-16" />
              <button onClick={handleAdd} className="px-2 py-1 bg-brew-600 text-white text-xs rounded hover:bg-brew-700">Add</button>
              <button onClick={() => setAdding(false)} className="px-2 py-1 text-stone-500 text-xs">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-2 text-xs text-brew-600 hover:text-brew-700">+ Add alias</button>
          )}
        </div>

        <div className="flex gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Geo</label>
            <div className="flex gap-1">
              {GEOS.map(g => (
                <button
                  key={g}
                  onClick={() => onGeoChange(g)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    geo === g ? 'bg-brew-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Timeframe</label>
            <div className="flex gap-1">
              {TIMEFRAMES.map(t => (
                <button
                  key={t}
                  onClick={() => onTimeframeChange(t)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    timeframe === t ? 'bg-brew-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
