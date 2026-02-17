import { useState } from 'react'
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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">IP Configuration</h2>

      <div className="space-y-4">
        {/* Editable name */}
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Primary Name</label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameVal(ip.name) } }}
                autoFocus
                className="flex-1 px-2 py-1 border border-brew-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brew-400"
              />
              <button onClick={handleSaveName} className="px-2 py-1 bg-brew-600 text-white text-xs rounded hover:bg-brew-700">Save</button>
              <button onClick={() => { setEditingName(false); setNameVal(ip.name) }} className="px-2 py-1 text-stone-500 text-xs">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-stone-800 font-medium">{ip.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-brew-600 transition-opacity"
                title="Edit name"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Aliases */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide">Aliases</label>
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-brew-600 bg-brew-50 border border-brew-200 rounded hover:bg-brew-100 disabled:opacity-50 transition-colors"
              title="Discover aliases via Claude AI"
            >
              {discovering ? (
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              )}
              {discovering ? 'Discovering...' : 'Discover'}
            </button>
          </div>
          <div className="space-y-1">
            {ip.aliases.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm group py-0.5">
                <button
                  onClick={() => toggleAlias(a)}
                  className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
                    a.enabled ? 'bg-brew-600 border-brew-600 text-white' : 'border-stone-300'
                  }`}
                >
                  {a.enabled && '✓'}
                </button>
                <span className={`${a.enabled ? 'text-stone-800' : 'text-stone-400 line-through'} min-w-0 truncate`}>{a.alias}</span>
                <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">{a.locale}</span>
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
                    className="text-[10px] text-stone-400 hover:text-brew-600 hover:bg-brew-50 px-1 py-0.5 rounded shrink-0 transition-colors cursor-pointer"
                    title="Click to edit weight"
                  >
                    w={a.weight}
                  </button>
                )}
                {a.original_weight !== null && a.original_weight !== undefined && a.weight !== a.original_weight && (
                  <button
                    onClick={() => handleResetWeight(a)}
                    className="text-[10px] text-stone-400 hover:text-brew-600 transition-colors shrink-0"
                    title={`Reset to original weight (${a.original_weight})`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAlias(a)}
                  className="opacity-0 group-hover:opacity-100 ml-auto text-stone-400 hover:text-red-500 transition-opacity shrink-0"
                  title="Remove alias"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Inline add alias — always visible */}
          <div className="mt-2 flex gap-1.5 items-center">
            <input
              value={newAlias}
              onChange={e => setNewAlias(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddAlias()}
              placeholder="Add alias..."
              className="flex-1 min-w-0 px-2 py-1 border border-stone-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brew-400 focus:border-transparent"
            />
            <select
              value={newLocale}
              onChange={e => setNewLocale(e.target.value)}
              className="px-1.5 py-1 border border-stone-200 rounded text-xs text-stone-600 focus:outline-none"
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
              className="w-12 px-1.5 py-1 border border-stone-200 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-brew-400"
            />
            <button
              onClick={handleAddAlias}
              disabled={!newAlias.trim()}
              className="px-2 py-1 bg-brew-600 text-white text-xs rounded hover:bg-brew-700 disabled:opacity-30 shrink-0"
            >
              +
            </button>
          </div>
        </div>

        {/* Geo & Timeframe */}
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
