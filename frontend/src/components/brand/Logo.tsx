type LogoProps = {
  variant?: 'mark' | 'horizontal'
  tone?: 'light' | 'dark'
  className?: string
}

// Interim vector built from the brand sheet. Replace with the designer's SVG exports when available.
export function Logo({ variant = 'horizontal', tone = 'light', className }: LogoProps) {
  const fd = tone === 'light' ? 'var(--color-navy)' : 'var(--color-white)'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg
        viewBox="0 0 132 44"
        role="img"
        aria-label="Faster Delivery Buddy"
        className="h-8 w-auto shrink-0"
      >
        <text
          x="0"
          y="38"
          fontFamily="'Inter Variable', system-ui, sans-serif"
          fontSize="44"
          fontWeight="900"
          fontStyle="italic"
          letterSpacing="-3"
        >
          <tspan fill={fd}>FD</tspan>
          <tspan fill="var(--color-blue)">B</tspan>
        </text>
        <path d="M100 20h20v-7l12 10-12 10v-7h-20z" fill="var(--color-blue)" />
      </svg>
      {variant === 'horizontal' && (
        <span className="hidden leading-tight sm:block">
          <span
            className={`block text-sm font-extrabold tracking-wide uppercase ${tone === 'light' ? 'text-navy' : 'text-white'}`}
          >
            Faster Delivery Buddy
          </span>
          <span className={`block text-xs ${tone === 'light' ? 'text-slate' : 'text-white/70'}`}>
            Your Favorite Finds, Closer Than Ever.
          </span>
        </span>
      )}
    </span>
  )
}
