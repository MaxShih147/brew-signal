import { useState } from 'react'
import { Plus, X, Tv, Film, Gamepad2, Cake, Pin } from 'lucide-react'
import type { IPEvent } from '../types'
import { createEvent, deleteEvent } from '../api/client'

interface Props {
  ipId: string
  events: IPEvent[]
  onUpdate: () => void
}

const EVENT_TYPE_META: Record<string, { label: string; icon: typeof Tv; color: string }> = {
  anime_air: { label: 'Anime', icon: Tv, color: 'text-violet-500' },
  movie_release: { label: 'Movie', icon: Film, color: 'text-blue-500' },
  game_release: { label: 'Game', icon: Gamepad2, color: 'text-emerald-500' },
  anniversary: { label: 'Anniversary', icon: Cake, color: 'text-amber-500' },
  other: { label: 'Other', icon: Pin, color: 'text-stone-500' },
}

const EVENT_TYPES = Object.keys(EVENT_TYPE_META)

export default function EventsCard({ ipId, events, onUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ event_type: 'anime_air', title: '', event_date: '' })
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!form.title || !form.event_date) return
    setSaving(true)
    try {
      await createEvent(ipId, { ...form, source: 'manual' })
      setForm({ event_type: 'anime_air', title: '', event_date: '' })
      setAdding(false)
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    await deleteEvent(eventId)
    onUpdate()
  }

  const today = new Date()

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="card-header mb-0">Events</h2>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-brew-50 text-brew-600 hover:bg-brew-100 transition-colors"
        >
          {adding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {adding ? 'Cancel' : 'Add'}
        </button>
      </div>

      <p className="text-xs text-stone-400 mb-3">
        Upcoming releases & milestones drive the Timing Window score.
      </p>

      {adding && (
        <div className="mb-4 p-3 bg-brew-50/50 rounded-xl space-y-2 border border-brew-100">
          <select
            value={form.event_type}
            onChange={e => setForm({ ...form, event_type: e.target.value })}
            className="w-full text-sm border border-brew-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brew-300"
          >
            {EVENT_TYPES.map(t => {
              const meta = EVENT_TYPE_META[t]
              return <option key={t} value={t}>{meta.label}</option>
            })}
          </select>
          <input
            type="text"
            placeholder="Event title (e.g. Chiikawa S2 Ep1)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="input-field"
          />
          <input
            type="date"
            value={form.event_date}
            onChange={e => setForm({ ...form, event_date: e.target.value })}
            className="input-field"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !form.title || !form.event_date}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Event'}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-stone-400">No events added yet.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map(event => {
            const eventDate = new Date(event.event_date)
            const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const diffWeeks = (diffDays / 7).toFixed(1)
            const isPast = diffDays < 0
            const meta = EVENT_TYPE_META[event.event_type] || EVENT_TYPE_META.other
            const Icon = meta.icon

            return (
              <div key={event.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl group transition-colors ${isPast ? 'bg-stone-50' : 'bg-emerald-50/50'}`}>
                <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-700 truncate">{event.title}</div>
                  <div className="text-[11px] text-stone-400">
                    {event.event_date}
                    {isPast
                      ? ` (${Math.abs(diffDays)}d ago)`
                      : ` (in ${diffWeeks}w)`
                    }
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 shrink-0 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
