'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { getTimeseries, getVisitSummary, Metric, TimePoint, VisitSummary } from '@/services/trafficService'

const METRICS: { v: Metric; label: string }[] = [
  { v: 'visits', label: '방문자' }, { v: 'signups', label: '신규 가입' },
  { v: 'checkins', label: '체크인' }, { v: 'searches', label: '검색' }, { v: 'activity', label: '활동' },
]
const PERIODS: { d: number; label: string }[] = [
  { d: 7, label: '7일' }, { d: 30, label: '30일' }, { d: 90, label: '3개월' },
  { d: 180, label: '6개월' }, { d: 270, label: '9개월' }, { d: 365, label: '12개월' },
]

export default function TrafficSection() {
  const [metric, setMetric] = useState<Metric>('signups')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<TimePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<VisitSummary | null>(null)

  useEffect(() => { getVisitSummary().then(setSummary) }, [])
  useEffect(() => {
    setLoading(true)
    getTimeseries(metric, days).then((d) => { setData(d); setLoading(false) })
  }, [metric, days])

  const total = useMemo(() => data.reduce((s, p) => s + p.count, 0), [data])
  const allZero = total === 0

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <SummaryCard label="오늘 방문자" value={summary?.today_uv ?? 0} delta={summary ? summary.today_uv - summary.yesterday_uv : null} />
        <SummaryCard label="오늘 페이지뷰" value={summary?.today_pv ?? 0} />
        <SummaryCard label="인기 페이지" text={summary?.top_path ?? '—'} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
        {METRICS.map((m) => (
          <button key={m.v} onClick={() => setMetric(m.v)} style={tab(metric === m.v)}>{m.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {PERIODS.map((p) => (
          <button key={p.d} onClick={() => setDays(p.d)} style={chip(days === p.d)}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>불러오는 중...</div>
      ) : allZero ? (
        <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, gap: 6 }}>
          <div style={{ fontSize: 28 }}>📊</div>
          {metric === 'visits' ? '방문 데이터를 수집하는 중이에요 (오늘부터)' : '아직 이 기간에 데이터가 없어요'}
        </div>
      ) : (
        <Chart data={data} />
      )}
      {!loading && !allZero && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'right' }}>기간 합계 {total.toLocaleString()}</p>}
    </div>
  )
}

function Chart({ data }: { data: TimePoint[] }) {
  const W = 700, H = 180, PAD = 8
  const max = Math.max(1, ...data.map((d) => d.count))
  const n = data.length
  const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const ticks = [0, Math.floor(n / 2), n - 1].filter((i, idx, a) => a.indexOf(i) === idx && i >= 0 && i < n)

  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - PAD) / (W - PAD * 2)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const hi = hover != null ? data[hover] : null
  const hx = hover != null ? x(hover) : 0
  const hy = hi ? y(hi.count) : 0
  const tipLeft = Math.min(Math.max(hx, 60), W - 60)

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hi && <>
          <line x1={hx} y1={PAD} x2={hx} y2={H - PAD} stroke="var(--accent)" strokeWidth="1" opacity="0.4" vectorEffect="non-scaling-stroke" />
          <circle cx={hx} cy={hy} r="4" fill="var(--accent)" stroke="#fff" strokeWidth="1.5" />
        </>}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H + 14} fontSize="10" fill="var(--muted)" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {data[i]?.date?.slice(5)}
          </text>
        ))}
      </svg>
      {hi && (
        <div style={{ position: 'absolute', top: 0, left: `${(tipLeft / W) * 100}%`, transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '5px 9px', borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {hi.date} · {hi.count.toLocaleString()}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, delta, text }: { label: string; value?: number; delta?: number | null; text?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      {text !== undefined ? (
        <div style={{ fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</div>
      ) : (
        <div style={{ fontSize: 18, fontWeight: 900 }}>{(value ?? 0).toLocaleString()}</div>
      )}
      {delta != null && delta !== 0 && (
        <div style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
        </div>
      )}
    </div>
  )
}

function tab(active: boolean): React.CSSProperties {
  return { flexShrink: 0, padding: '7px 13px', borderRadius: 8, border: 'none', background: active ? 'var(--accent)' : 'var(--surface2)', color: active ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
}
function chip(active: boolean): React.CSSProperties {
  return { flexShrink: 0, padding: '6px 11px', borderRadius: 9999, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
}

