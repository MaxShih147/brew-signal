interface Props {
  signal: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-3 h-3',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
}

export default function TrafficLight({ signal, size = 'md' }: Props) {
  const s = sizeMap[size]

  const colorClass =
    signal === 'green'
      ? 'bg-emerald-400 shadow-emerald-400/50'
      : signal === 'yellow'
        ? 'bg-amber-400 shadow-amber-400/50'
        : signal === 'red'
          ? 'bg-red-400 shadow-red-400/50'
          : 'bg-stone-300'

  return (
    <span
      className={`inline-block rounded-full ${s} ${colorClass} shadow-md`}
      title={signal ? `Signal: ${signal.toUpperCase()}` : 'No signal'}
    />
  )
}
