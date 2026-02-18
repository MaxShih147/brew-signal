import { useState } from 'react'
import type { IPEvent } from '../types'
import { createEvent, deleteEvent } from '../api/client'

interface Props {
  ipId: string
  events: IPEvent[]
  onUpdate: () => void
}

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  anime_air: { label: 'Anime', icon: '📺' },
  movie_release: { label: 'Movie', icon: '🎬' },
  game_release: { label: 'Game', icon: '🎮' },
  anniversary: { label: 'Anniversary', icon: '🎂' },
  other: { label: 'Other', icon: '📌' },
}

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS)

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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-stone-800">Events</h2>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs px-2 py-1 rounded bg-brew-50 text-brew-600 hover:bg-brew-100 transition-colors"
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      <p className="text-xs text-stone-400 mb-3">
        Upcoming releases & milestones drive the Timing Window score.
      </p>

      {adding && (
        <div className="mb-4 p-3 bg-stone-50 rounded-lg space-y-2">
          <select
            value={form.event_type}
            onChange={e => setForm({ ...form, event_type: e.target.value })}
            className="w-full text-sm border border-stone-200 rounded px-2 py-1.5"
          >
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t].icon} {EVENT_TYPE_LABELS[t].label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Event title (e.g. Chiikawa S2 Ep1)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full text-sm border border-stone-200 rounded px-2 py-1.5"
          />
          <input
            type="date"
            value={form.event_date}
            onChange={e => setForm({ ...form, event_date: e.target.value })}
            className="w-full text-sm border border-stone-200 rounded px-2 py-1.5"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !form.title || !form.event_date}
            className="w-full text-sm px-3 py-1.5 bg-brew-600 text-white rounded hover:bg-brew-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Add Event'}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-stone-400">No events added yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map(event => {
            const eventDate = new Date(event.event_date)
            const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const diffWeeks = (diffDays / 7).toFixed(1)
            const isPast = diffDays < 0
            const meta = EVENT_TYPE_LABELS[event.event_type] || EVENT_TYPE_LABELS.other

            return (
              <div key={event.id} className={`flex items-start gap-2 p-2 rounded-lg ${isPast ? 'bg-stone-50' : 'bg-emerald-50'}`}>
                <span className="text-sm flex-shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-700 truncate">{event.title}</div>
                  <div className="text-xs text-stone-400">
                    {event.event_date}
                    {isPast
                      ? ` (${Math.abs(diffDays)}d ago)`
                      : ` (in ${diffWeeks}w)`
                    }
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="text-stone-300 hover:text-red-400 flex-shrink-0 p-0.5"
                  title="Remove event"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
