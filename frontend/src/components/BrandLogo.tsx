interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
}

export default function BrandLogo({ size = 'md', className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={`${SIZES[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id="wave-cut">
        <rect width="64" height="64" fill="white" />
        <path d="M12 32 Q20 26 28 32 Q36 38 44 32" stroke="black" strokeWidth="3" fill="none" strokeLinecap="round" />
      </mask>
      <rect x="12" y="16" width="32" height="34" rx="5" fill="currentColor" mask="url(#wave-cut)" />
      <path d="M44 24h5a6 6 0 0 1 0 12h-5" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
