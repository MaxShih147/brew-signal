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

const ALIAS_COLORS = ['#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

export default function TrendChart({ compositeData, byAliasData, loading }: Props) {
  const [enabledAliases, setEnabledAliases] = useState<Set<string>>(new Set())

  if (loading) {
    return (
      <div className="card">
        <h2 className="card-header">Trend</h2>
        <div className="h-64 flex items-center justify-center text-stone-400 text-sm">Loading chart...</div>
      </div>
    )
  }

  const aliasNames = [...new Set(byAliasData.map(p => p.alias || 'unknown'))]
  const aliasDateMap = new Map<string, Record<string, number>>()
  for (const p of byAliasData) {
    if (!aliasDateMap.has(p.date)) {
      aliasDateMap.set(p.date, {})
    }
    aliasDateMap.get(p.date)![p.alias || 'unknown'] = p.value
  }

  const chartData = compositeData.map(d => {
    const row: Record<string, any> = {
      date: d.date,
      composite_value: d.composite_value,
      ma7: d.ma7,
      ma28: d.ma28,
    }
    const aliasVals = aliasDateMap.get(d.date)
    if (aliasVals) {
      for (const name of enabledAliases) {
        if (aliasVals[name] !== undefined) {
          row[name] = aliasVals[name]
        }
      }
    }
    return row
  })

  const toggleAlias = (name: string) => {
    setEnabledAliases(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="card">
      <h2 className="card-header">Trend</h2>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f2d7b0" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#a8a29e' }}
              tickFormatter={d => {
                const dt = new Date(d)
                return `${dt.getMonth()+1}/${dt.getDate()}`
              }}
            />
            <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                border: '1px solid #f2d7b0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}
              labelFormatter={d => new Date(d).toLocaleDateString()}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="composite_value" stroke="#c46a1e" strokeWidth={2} dot={false} name="Composite" />
            <Line type="monotone" dataKey="ma7" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="MA7" />
            <Line type="monotone" dataKey="ma28" stroke="#10b981" strokeWidth={1.5} strokeDasharray="8 4" dot={false} name="MA28" />
            {[...enabledAliases].map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={ALIAS_COLORS[aliasNames.indexOf(name) % ALIAS_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                name={name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {aliasNames.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {aliasNames.map((name, i) => {
            const active = enabledAliases.has(name)
            const color = ALIAS_COLORS[i % ALIAS_COLORS.length]
            return (
              <button
                key={name}
                onClick={() => toggleAlias(name)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
                  active
                    ? 'border-brew-300 bg-brew-50 text-stone-800 font-medium'
                    : 'border-brew-100 bg-white text-stone-400 hover:text-stone-600 hover:border-brew-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: active ? color : '#d6d3d1' }}
                />
                {name}
              </button>
            )
          })}
        </div>
      )}

      {compositeData.length === 0 && byAliasData.length === 0 && (
        <p className="text-center text-sm text-stone-400 mt-2">
          No trend data yet. Run a collection to fetch data.
        </p>
      )}
    </div>
  )
}
