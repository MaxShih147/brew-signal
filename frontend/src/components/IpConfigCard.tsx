import { useState } from 'react'
import { Pencil, X, RotateCcw, Search, Loader2, Check } from 'lucide-react'
import type { IPDetail, Alias } from '../types'
import { addAlias, updateAlias, deleteAlias, updateIP, discoverAliases, resetAliasWeight } from '../api/client'

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
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(ip.name)
  const [newAlias, setNewAlias] = useState('')
  const [newLocale, setNewLocale] = useState('en')
  const [newWeight, setNewWeight] = useState('1.0')
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
  const [weightVal, setWeightVal] = useState('')
  const [discovering, setDiscovering] = useState(false)

  const handleSaveName = async () => {
    if (!nameVal.trim() || nameVal.trim() === ip.name) {
      setEditingName(false)
      setNameVal(ip.name)
      return
    }
    await updateIP(ip.id, nameVal.trim())
    setEditingName(false)
    onRefresh()
  }

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return
    await addAlias(ip.id, { alias: newAlias.trim(), locale: newLocale, weight: parseFloat(newWeight) || 1.0 })
    setNewAlias('')
    setNewWeight('1.0')
    onRefresh()
  }

  const handleDeleteAlias = async (a: Alias) => {
    if (!confirm(`Remove alias "${a.alias}"?`)) return
    await deleteAlias(a.id)
    onRefresh()
  }

  const toggleAlias = async (a: Alias) => {
    await updateAlias(a.id, { enabled: !a.enabled })
    onRefresh()
  }

  const startEditWeight = (a: Alias) => {
    setEditingWeightId(a.id)
    setWeightVal(String(a.weight))
  }

  const saveWeight = async (a: Alias) => {
    const parsed = parseFloat(weightVal)
    if (isNaN(parsed) || parsed === a.weight) {
      setEditingWeightId(null)
      return
    }
    await updateAlias(a.id, { weight: parsed })
    setEditingWeightId(null)
    onRefresh()
  }

  const handleResetWeight = async (a: Alias) => {
    await resetAliasWeight(a.id)
    onRefresh()
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      await discoverAliases(ip.id, true)
      onRefresh()
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-header">Configuration</h2>

      <div className="space-y-4">
        {/* Editable name */}
        <div>
          <label className="block text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-1">Name</label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameVal(ip.name) } }}
                autoFocus
                className="input-field flex-1"
              />
              <button onClick={handleSaveName} className="btn-primary text-xs px-3"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEditingName(false); setNameVal(ip.name) }} className="btn-ghost text-xs px-2"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-stone-800 font-medium">{ip.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-brew-600 transition-opacity"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Aliases */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-medium text-stone-400 uppercase tracking-wider">Aliases</label>
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-brew-600 bg-brew-50 border border-brew-200 rounded-lg hover:bg-brew-100 disabled:opacity-50 transition-colors"
            >
              {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              {discovering ? 'Discovering...' : 'Discover'}
            </button>
          </div>
          <div className="space-y-1">
            {ip.aliases.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm group py-0.5">
                <button
                  onClick={() => toggleAlias(a)}
                  className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 transition-colors ${
                    a.enabled ? 'bg-brew-600 border-brew-600 text-white' : 'border-stone-300 hover:border-brew-400'
                  }`}
                >
                  {a.enabled && <Check className="w-2.5 h-2.5" />}
                </button>
                <span className={`${a.enabled ? 'text-stone-800' : 'text-stone-400 line-through'} min-w-0 truncate`}>{a.alias}</span>
                <span className="pill bg-stone-100 text-stone-500 shrink-0">{a.locale}</span>
                {editingWeightId === a.id ? (
                  <input
                    value={weightVal}
                    onChange={e => setWeightVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveWeight(a); if (e.key === 'Escape') setEditingWeightId(null) }}
                    onBlur={() => saveWeight(a)}
                    autoFocus
                    className="w-12 px-1 py-0.5 border border-brew-300 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-brew-400"
                  />
                ) : (
                  <button
                    onClick={() => startEditWeight(a)}
                    className="text-[10px] text-stone-400 hover:text-brew-600 hover:bg-brew-50 px-1 py-0.5 rounded shrink-0 transition-colors font-mono"
                  >
                    w={a.weight}
                  </button>
                )}
                {a.original_weight !== null && a.original_weight !== undefined && a.weight !== a.original_weight && (
                  <button
                    onClick={() => handleResetWeight(a)}
                    className="text-stone-400 hover:text-brew-600 transition-colors shrink-0"
                    title={`Reset to original weight (${a.original_weight})`}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAlias(a)}
                  className="opacity-0 group-hover:opacity-100 ml-auto text-stone-400 hover:text-red-500 transition-opacity shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5 items-center">
            <input
              value={newAlias}
              onChange={e => setNewAlias(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddAlias()}
              placeholder="Add alias..."
              className="flex-1 min-w-0 px-2 py-1 bg-white border border-brew-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
            />
            <select
              value={newLocale}
              onChange={e => setNewLocale(e.target.value)}
              className="px-1.5 py-1 border border-brew-100 rounded-lg text-xs text-stone-600 focus:outline-none bg-white"
            >
              <option value="en">en</option>
              <option value="zh">zh</option>
              <option value="jp">jp</option>
              <option value="ko">ko</option>
              <option value="other">other</option>
            </select>
            <input
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              placeholder="1.0"
              className="w-12 px-1.5 py-1 border border-brew-100 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-brew-300 bg-white"
            />
            <button
              onClick={handleAddAlias}
              disabled={!newAlias.trim()}
              className="px-2.5 py-1 bg-brew-600 text-white text-xs rounded-lg hover:bg-brew-700 disabled:opacity-30 shrink-0"
            >
              +
            </button>
          </div>
        </div>

        {/* Geo & Timeframe */}
        <div className="flex gap-4">
          <div>
            <label className="block text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">Geo</label>
            <div className="flex gap-1">
              {GEOS.map(g => (
                <button
                  key={g}
                  onClick={() => onGeoChange(g)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    geo === g ? 'bg-brew-600 text-white shadow-sm' : 'bg-white text-stone-500 hover:bg-brew-50 border border-brew-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">Timeframe</label>
            <div className="flex gap-1">
              {TIMEFRAMES.map(t => (
                <button
                  key={t}
                  onClick={() => onTimeframeChange(t)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    timeframe === t ? 'bg-brew-600 text-white shadow-sm' : 'bg-white text-stone-500 hover:bg-brew-50 border border-brew-100'
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
