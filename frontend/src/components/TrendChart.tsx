import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyTrendPoint, TrendPointRaw } from '../types'

interface Props {
  compositeData: DailyTrendPoint[]
  byAliasData: TrendPointRaw[]
  loading: boolean
}

export default function TrendChart({ compositeData, byAliasData, loading }: Props) {
  const [mode, setMode] = useState<'composite' | 'by_alias'>('composite')

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Trend</h2>
        <div className="h-64 flex items-center justify-center text-stone-400">Loading chart...</div>
      </div>
    )
  }

  // Build by-alias chart data
  const aliasNames = [...new Set(byAliasData.map(p => p.alias || 'unknown'))]
  const aliasChartData: Record<string, any>[] = []
  const aliasDateMap = new Map<string, Record<string, any>>()
  for (const p of byAliasData) {
    const key = p.date
    if (!aliasDateMap.has(key)) {
      aliasDateMap.set(key, { date: key })
    }
    aliasDateMap.get(key)![p.alias || 'unknown'] = p.value
  }
  aliasDateMap.forEach(v => aliasChartData.push(v))
  aliasChartData.sort((a, b) => a.date.localeCompare(b.date))

  const COLORS = ['#d68228', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b']

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-800">Trend</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('composite')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium ${mode === 'composite' ? 'bg-brew-600 text-white' : 'bg-stone-100 text-stone-600'}`}
          >
            Composite + MA
          </button>
          <button
            onClick={() => setMode('by_alias')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium ${mode === 'by_alias' ? 'bg-brew-600 text-white' : 'bg-stone-100 text-stone-600'}`}
          >
            By Alias
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'composite' ? (
            <LineChart data={compositeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={d => {
                  const dt = new Date(d)
                  return `${dt.getMonth()+1}/${dt.getDate()}`
                }}
              />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={d => new Date(d).toLocaleDateString()}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="composite_value" stroke="#d68228" strokeWidth={2} dot={false} name="Composite" />
              <Line type="monotone" dataKey="ma7" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="MA7" />
              <Line type="monotone" dataKey="ma28" stroke="#10b981" strokeWidth={1.5} strokeDasharray="8 4" dot={false} name="MA28" />
            </LineChart>
          ) : (
            <LineChart data={aliasChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={d => {
                  const dt = new Date(d)
                  return `${dt.getMonth()+1}/${dt.getDate()}`
                }}
              />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {aliasNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {compositeData.length === 0 && byAliasData.length === 0 && (
        <p className="text-center text-sm text-stone-400 mt-2">
          No trend data yet. Run a collection to fetch data.
        </p>
      )}
    </div>
  )
}
