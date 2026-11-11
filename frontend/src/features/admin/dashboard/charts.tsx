import { useCallback, useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

// Categorical slots in fixed order, validated for colour-blind safety on each theme's card surface (see styles.css).
// Never cycle or generate more: past five, fold into "Other".
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const
// Text set inside a filled block: white, except near-black on yellow.
const INK_ON = ['#ffffff', '#ffffff', '#ffffff', '#0b0b0b', '#ffffff'] as const
const GRID = 'var(--chart-grid)'
const BASELINE = 'var(--chart-baseline)'
const AXIS_TEXT = 'var(--chart-axis)'
const SURFACE = 'var(--color-surface)'
const DEEMPHASIS = 'var(--chart-baseline)'
const LABEL = 'var(--color-ink)'

// Chart geometry uses plain numbers; every value a person reads is formatted from the exact API string.
// Charts draw nothing until their box is measured, so a chart never props its card wider than the screen.
// The fallback is only for environments without layout (tests).
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const [width, setWidth] = useState(0)
  const ref = useCallback((el: T | null) => {
    if (!el) return
    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.clientWidth || fallback)
      return
    }
    setWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fallback])
  return [ref, width] as const
}

function niceStep(raw: number) {
  if (raw <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const f = raw / power
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * power
}

function niceScale(max: number, integer: boolean) {
  let step = niceStep(max / 4)
  if (integer) step = Math.max(1, Math.ceil(step))
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)
  return { top, ticks }
}

const full = new Intl.NumberFormat('en-PH')
const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 })

// Axis ticks: in full under 10,000; compact on an axis that reaches it. One style per axis.
function axisFormatter(top: number, prefix: string) {
  return (n: number) => prefix + (top >= 10_000 ? compact : full).format(n)
}

const dayFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
export const shortDay = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00Z`))
export const longDay = (iso: string) => longDayFormat.format(new Date(`${iso}T00:00:00Z`))

// Evenly spaced label positions that always include the first and last day.
function labelIndexes(n: number, room: number) {
  if (n <= 1) return [0]
  const count = Math.max(2, Math.min(n, room))
  const step = (n - 1) / (count - 1)
  return Array.from(new Set(Array.from({ length: count }, (_, i) => Math.round(i * step))))
}

type Point = { date: string; value: number; display: string }

function Tooltip({ value, label, color, x, y, width }: { value: string; label: string; color: string; x: number; y: number; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70)
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-line"
      style={{ left, top: y - 10 }}
    >
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-ink">{value}</span>
      </div>
      <div className="mt-0.5 text-slate">{label}</div>
    </div>
  )
}

type Frame = { width: number; height: number; m: { top: number; right: number; bottom: number; left: number } }

function Axes({ frame, ticks, top, format, labels }: { frame: Frame; ticks: number[]; top: number; format: (n: number) => string; labels: { x: number; text: string }[] }) {
  const { width, height, m } = frame
  const ph = height - m.top - m.bottom
  const y = (v: number) => m.top + ph - (v / top) * ph
  return (
    <g aria-hidden fontSize={11} fill={AXIS_TEXT} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {ticks.map((t) => (
        <g key={t}>
          {t > 0 && <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} shapeRendering="crispEdges" />}
          <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
            {format(t)}
          </text>
        </g>
      ))}
      <line x1={m.left} x2={width - m.right} y1={m.top + ph} y2={m.top + ph} stroke={BASELINE} strokeWidth={1} shapeRendering="crispEdges" />
      {labels.map((l) => (
        <text key={l.x} x={l.x} y={height - 8} textAnchor={l.x - 24 < 0 ? 'start' : l.x + 24 > width ? 'end' : 'middle'}>
          {l.text}
        </text>
      ))}
    </g>
  )
}

function useActiveIndex(n: number) {
  const [active, setActive] = useState<number | null>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    if (!n) return
    const current = active ?? n - 1
    const next = e.key === 'ArrowLeft' ? current - 1 : e.key === 'ArrowRight' ? current + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null
    if (next === null) return
    e.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, next)))
  }
  return { active, setActive, onKeyDown, onFocus: () => setActive(n - 1), onBlur: () => setActive(null) }
}

// One series over time: 2px line, a 10% wash, crosshair that snaps to the nearest day.
export function TrendChart({ points, summary, prefix = '', height = 240 }: { points: Point[]; summary: string; prefix?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { active, setActive, onKeyDown, onFocus, onBlur } = useActiveIndex(points.length)
  const frame: Frame = { width, height, m: { top: 16, right: 16, bottom: 28, left: 64 } }
  const { m } = frame
  const pw = Math.max(1, width - m.left - m.right)
  const ph = height - m.top - m.bottom
  const n = points.length
  const { top, ticks } = niceScale(Math.max(0, ...points.map((p) => p.value)), false)
  const x = (i: number) => m.left + (n <= 1 ? pw / 2 : (i * pw) / (n - 1))
  const y = (v: number) => m.top + ph - (v / top) * ph
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${m.top + ph}L${x(0).toFixed(1)},${m.top + ph}Z` : ''
  const labels = labelIndexes(n, Math.floor(pw / 80)).map((i) => ({ x: x(i), text: shortDay(points[i]?.date ?? '') }))
  const last = points[n - 1]
  const peakIndex = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? 0) ? i : best), 0)
  const peak = points[peakIndex]
  const shown = active !== null ? points[active] : undefined

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left) / Math.max(1, box.width)
    setActive(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))))
  }

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ minHeight: height }}>
      <svg width={width} height={height} role="img" aria-label={summary} tabIndex={0} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
        <Axes frame={frame} ticks={ticks} top={top} format={axisFormatter(top, prefix)} labels={labels} />
        <path d={area} fill={SERIES[0]} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {shown && active !== null && (
          <>
            <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + ph} stroke={BASELINE} strokeWidth={1} shapeRendering="crispEdges" />
            <circle cx={x(active)} cy={y(shown.value)} r={6} fill={SERIES[0]} stroke={SURFACE} strokeWidth={2} />
          </>
        )}
        {last && active === null && <circle cx={x(n - 1)} cy={y(last.value)} r={6} fill={SERIES[0]} stroke={SURFACE} strokeWidth={2} />}
        {peak && peak.value > 0 && active === null && (
          <text
            x={x(peakIndex)}
            y={y(peak.value) - 12}
            textAnchor={x(peakIndex) + 50 > width - m.right ? 'end' : x(peakIndex) - 50 < m.left ? 'start' : 'middle'}
            fontSize={11}
            fontWeight={600}
            fill={LABEL}
          >
            Peak {peak.display}
          </text>
        )}
        <rect x={m.left} y={m.top} width={pw} height={ph} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
      </svg>
      {shown && active !== null && <Tooltip value={shown.display} label={longDay(shown.date)} color={SERIES[0]} x={x(active)} y={y(shown.value)} width={width} />}
    </div>
  )
}

// Counts per day: columns at most 24px wide with a 4px rounded top, square at the baseline.
export function ColumnChart({ points, summary, height = 220 }: { points: Point[]; summary: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { active, setActive, onKeyDown, onFocus, onBlur } = useActiveIndex(points.length)
  const frame: Frame = { width, height, m: { top: 16, right: 8, bottom: 28, left: 40 } }
  const { m } = frame
  const pw = Math.max(1, width - m.left - m.right)
  const ph = height - m.top - m.bottom
  const n = Math.max(1, points.length)
  const band = pw / n
  const barW = Math.max(1, Math.min(24, band - 2))
  const { top, ticks } = niceScale(Math.max(0, ...points.map((p) => p.value)), true)
  const cx = (i: number) => m.left + i * band + band / 2
  const labels = labelIndexes(points.length, Math.floor(pw / 80)).map((i) => ({ x: cx(i), text: shortDay(points[i]?.date ?? '') }))
  const shown = active !== null ? points[active] : undefined

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ minHeight: height }}>
      <svg width={width} height={height} role="img" aria-label={summary} tabIndex={0} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
        <Axes frame={frame} ticks={ticks} top={top} format={axisFormatter(top, '')} labels={labels} />
        {points.map((p, i) => {
          const h = (p.value / top) * ph
          if (h <= 0) return null
          const x0 = cx(i) - barW / 2
          const y0 = m.top + ph - h
          const r = Math.min(4, barW / 2, h)
          const d = `M${x0},${m.top + ph}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${m.top + ph}Z`
          return <path key={p.date} d={d} fill={SERIES[0]} opacity={active === null || active === i ? 1 : 0.55} />
        })}
        {points.map((p, i) => (
          <rect key={p.date} x={m.left + i * band} y={m.top} width={band} height={ph} fill="transparent" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} />
        ))}
      </svg>
      {shown && active !== null && <Tooltip value={shown.display} label={longDay(shown.date)} color={SERIES[0]} x={cx(active)} y={m.top + ph - (shown.value / top) * ph} width={width} />}
    </div>
  )
}

// A small trend under a stat value: de-emphasised line, the latest point in the accent.
export function Sparkline({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(120)
  const h = 32
  const n = values.length
  const max = Math.max(1, ...values)
  const x = (i: number) => 3 + (n <= 1 ? 0 : (i * (width - 6)) / (n - 1))
  const y = (v: number) => h - 4 - (v / max) * (h - 8)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last = values[n - 1]
  return (
    <div ref={ref} aria-hidden className="h-8 w-full min-w-0">
      <svg width={width} height={h}>
        <path d={d} fill="none" stroke={DEEMPHASIS} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {last !== undefined && <circle cx={x(n - 1)} cy={y(last)} r={3} fill={SERIES[0]} />}
      </svg>
    </div>
  )
}

export type Part = { key: string; label: string; count: number }

// One whole split into parts: 28px blocks, 2px gaps, share printed inside when it fits.
export function SegmentedBar({ parts, noun }: { parts: Part[]; noun: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<string | null>(null)
  const total = parts.reduce((s, p) => s + p.count, 0)
  if (!total) return <p className="py-6 text-sm text-slate">No {noun} in this period.</p>

  const share = (c: number) => Math.round((c / total) * 100)
  const summary = parts.map((p) => `${p.label} ${p.count}`).join(', ')
  const shown = parts.find((p) => p.key === active)

  return (
    <div className="relative">
      <div ref={ref} role="img" aria-label={`${total} ${noun}: ${summary}`} className="flex h-7 gap-0.5">
        {parts.map((p, i) => {
          if (!p.count) return null
          const label = `${share(p.count)}%`
          const fits = width * (p.count / total) >= label.length * 7 + 14
          return (
            <div
              key={p.key}
              tabIndex={0}
              aria-label={`${p.label}: ${p.count} ${noun}, ${share(p.count)}%`}
              onPointerEnter={() => setActive(p.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(p.key)}
              onBlur={() => setActive(null)}
              className="flex min-w-0 items-center rounded px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
              style={{ flexGrow: p.count, flexBasis: 0, background: SERIES[i], color: INK_ON[i], opacity: active === null || active === p.key ? 1 : 0.7 } as CSSProperties}
            >
              {fits && label}
            </div>
          )
        })}
      </div>
      {shown && (
        <div aria-hidden className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-line">
          <span className="text-sm font-semibold text-ink">
            {shown.count} {noun} · {share(shown.count)}%
          </span>
          <div className="mt-0.5 text-slate">{shown.label}</div>
        </div>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate" aria-label="Legend">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export type RankedRow = { name: string; value: number; display: string; detail: string }

// Ranked horizontal bars in one colour: the value sits at the bar's tip.
export function RankedBars({ rows, empty }: { rows: RankedRow[]; empty: string }) {
  const [active, setActive] = useState<string | null>(null)
  if (!rows.length) return <p className="py-6 text-sm text-slate">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value))
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.name}
          tabIndex={0}
          aria-label={`${r.name}: ${r.display}, ${r.detail}`}
          onPointerEnter={() => setActive(r.name)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(r.name)}
          onBlur={() => setActive(null)}
          className="relative grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
        >
          <span className="truncate text-sm text-ink" title={r.name}>
            {r.name}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-3.5 shrink-0 rounded-r transition-opacity"
              style={{ width: `calc((100% - 6rem) * ${max ? r.value / max : 0})`, minWidth: r.value > 0 ? 2 : 0, background: SERIES[0], opacity: active === null || active === r.name ? 1 : 0.55 }}
            />
            <span className="text-xs font-semibold whitespace-nowrap text-ink tabular">{r.display}</span>
          </span>
          {active === r.name && (
            <span aria-hidden className="pointer-events-none absolute right-0 -top-1 z-10 -translate-y-full rounded-lg bg-surface px-3 py-1.5 text-xs whitespace-nowrap text-slate shadow-lg ring-1 ring-line">
              {r.detail}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

export type TableSpec = { columns: string[]; rows: (string | number)[][]; numeric: number[] }

// Every chart has a table twin: the same numbers without hovering or colour.
export function ChartCard({ title, subtitle, lead, table, children, className = '' }: { title: string; subtitle?: string; lead?: ReactNode; table?: TableSpec; children: ReactNode; className?: string }) {
  const id = useId()
  const [asTable, setAsTable] = useState(false)
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-sm font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate ring-1 ring-line transition hover:bg-paper hover:text-ink"
          >
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      {lead}
      <div className="mt-4">
        {asTable && table ? (
          <div className="max-h-72 overflow-auto rounded-lg ring-1 ring-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper text-slate">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`px-3 py-2 font-medium ${table.numeric.includes(i) ? 'text-right' : ''}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className={`px-3 py-1.5 text-ink ${table.numeric.includes(i) ? 'text-right tabular' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
