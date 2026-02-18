import { CalendarCheck, Milestone as MilestoneIcon } from 'lucide-react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { LaunchPlanData } from '../types'
import ConfidenceBadge from './ConfidenceBadge'

interface Props {
  data: LaunchPlanData | null
  loading: boolean
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const MILESTONE_COLORS: Record<string, string> = {
  'Launch': 'bg-emerald-500',
  'Production Start': 'bg-blue-500',
  'Sample Review': 'bg-amber-500',
  'Artwork Submission': 'bg-purple-500',
  'Design Start': 'bg-stone-500',
}

export default function LaunchPlanner({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="card">
        <h2 className="card-header">Launch Planner</h2>
        <p className="text-sm text-stone-400">Computing launch plan...</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="card">
        <h2 className="card-header">Launch Planner</h2>
        <p className="text-sm text-stone-400">No launch plan data. Set license dates in pipeline first.</p>
      </div>
    )
  }

  const chartData = data.launch_value_grid.map(w => ({
    week: formatWeek(w.week_start),
    weekRaw: w.week_start,
    launch_value: w.launch_value,
    demand: w.demand_score,
    event_boost: w.event_boost,
    saturation: -w.saturation_score,
    ops_risk: -w.operational_risk,
  }))

  // Find the recommended week label for ReferenceLine
  const recWeekLabel = data.recommended_launch_week
    ? formatWeek(data.recommended_launch_week)
    : null

  const bestValue = data.launch_value_grid.length
    ? Math.max(...data.launch_value_grid.map(w => w.launch_value))
    : 0

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="card-header mb-0">Launch Planner</h2>
        <CalendarCheck className="w-4 h-4 text-brew-500" />
        <div className="ml-auto">
          <ConfidenceBadge confidence={data.confidence} size="md" />
        </div>
      </div>

      {/* Recommended week + backups */}
      {data.recommended_launch_week && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-xs font-semibold text-emerald-700">Recommended</span>
            <span className="text-sm font-bold text-emerald-800">
              {formatDate(data.recommended_launch_week)}
            </span>
            <span className="text-xs font-mono text-emerald-600">
              ({bestValue.toFixed(1)} pts)
            </span>
          </div>
          {data.backup_weeks.map((w, i) => (
            <div key={w} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[10px] font-semibold text-stone-400">Backup {i + 1}</span>
              <span className="text-xs font-medium text-stone-600">{formatDate(w)}</span>
            </div>
          ))}
        </div>
      )}

      {/* License window */}
      {data.license_start_date && data.license_end_date && (
        <p className="text-[10px] text-stone-400 mb-4 font-mono">
          License window: {formatDate(data.license_start_date)} — {formatDate(data.license_end_date)}
        </p>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="mb-5">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: '#78716c' }}
                interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fafaf9',
                  border: '1px solid #e7e5e4',
                  borderRadius: '12px',
                  fontSize: '11px',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    launch_value: 'Launch Value',
                    demand: 'Demand',
                    event_boost: 'Event Boost',
                    saturation: 'Saturation',
                    ops_risk: 'Ops Risk',
                  }
                  return [value.toFixed(1), labels[name] || name]
                }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    launch_value: 'Launch Value',
                    demand: 'Demand',
                    event_boost: 'Event Boost',
                    saturation: 'Saturation (neg)',
                    ops_risk: 'Ops Risk (neg)',
                  }
                  return labels[value] || value
                }}
              />
              <Area
                type="monotone"
                dataKey="launch_value"
                stroke="#059669"
                fill="#d1fae5"
                strokeWidth={2}
                fillOpacity={0.5}
              />
              <Line type="monotone" dataKey="demand" stroke="#2563eb" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="event_boost" stroke="#7c3aed" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="saturation" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="ops_risk" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="3 3" />

              {/* Recommended week marker */}
              {recWeekLabel && (
                <ReferenceLine
                  x={recWeekLabel}
                  stroke="#059669"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{ value: 'REC', position: 'top', fontSize: 9, fill: '#059669' }}
                />
              )}

              {/* Event markers */}
              {data.events_in_window.map(event => {
                const eventLabel = formatWeek(event.event_date)
                // Only show if it exists in chart range
                const exists = chartData.some(d => d.week === eventLabel)
                if (!exists) return null
                return (
                  <ReferenceLine
                    key={event.id}
                    x={eventLabel}
                    stroke="#7c3aed"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    label={{ value: event.title.slice(0, 12), position: 'insideTopRight', fontSize: 8, fill: '#7c3aed' }}
                  />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Milestones timeline */}
      {data.milestones.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <MilestoneIcon className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-xs font-semibold text-stone-500 uppercase">Milestones</span>
          </div>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {[...data.milestones].reverse().map((m, i, arr) => (
              <div key={m.label} className="flex items-center">
                <div className="flex flex-col items-center min-w-[90px]">
                  <div className={`w-3 h-3 rounded-full ${MILESTONE_COLORS[m.label] || 'bg-stone-400'}`} />
                  <span className="text-[10px] font-semibold text-stone-600 mt-1 text-center leading-tight">
                    {m.label}
                  </span>
                  <span className="text-[9px] text-stone-400 font-mono">
                    {formatDate(m.target_date)}
                  </span>
                  {m.weeks_before_launch > 0 && (
                    <span className="text-[8px] text-stone-300">-{m.weeks_before_launch}w</span>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <div className="h-0.5 w-8 bg-stone-200 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explanations */}
      {data.explanations.length > 0 && (
        <div className="border-t border-brew-100 pt-3">
          <ul className="space-y-1.5">
            {data.explanations.map((exp, i) => (
              <li key={i} className="text-xs text-stone-600 flex gap-2">
                <span className="text-brew-400 mt-0.5">&#9656;</span>
                {exp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
