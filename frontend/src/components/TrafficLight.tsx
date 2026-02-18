interface Props {
  signal: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-2.5 h-2.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

const COLORS: Record<string, string> = {
  green: 'bg-emerald-400 shadow-emerald-400/40',
  yellow: 'bg-amber-400 shadow-amber-400/40',
  red: 'bg-red-400 shadow-red-400/40',
}

export default function TrafficLight({ signal, size = 'md' }: Props) {
  const color = (signal && COLORS[signal]) || 'bg-stone-300'
  return (
    <span
      className={`inline-block rounded-full shadow-md ${SIZES[size]} ${color}`}
      title={signal ? `Signal: ${signal.toUpperCase()}` : 'No signal'}
    />
  )
}
