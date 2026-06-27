'use client'
import { useEffect, useRef, useState } from 'react'
import { MemorialData, MemorialType } from '@/lib/memorial/types'
import { renderMemorial, generateAndDownloadMemorial } from '@/lib/memorial/generateMemorial'

const SAMPLE: MemorialData = {
  kind: 'route-complete',
  rallyNo: '000128',
  routeName: '홍대 굿즈샵 한바퀴',
  area: '홍대',
  type: 'goods-shop-tour',
  walkTime: 42,
  shopCount: 5,
  date: '2026.07.15',
  stampKind: 'route',
  takuPose: 'stamp-drag',
}

const TYPES: MemorialType[] = ['goods-shop-tour', 'popup-tour', 'cafe-tour', 'mixed-tour']

export default function MemorialDevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [routeName, setRouteName] = useState(SAMPLE.routeName)
  const [rallyNo, setRallyNo] = useState(SAMPLE.rallyNo)
  const [area, setArea] = useState(SAMPLE.area ?? '')
  const [type, setType] = useState<MemorialType>(SAMPLE.type!)
  const [walkTime, setWalkTime] = useState(String(SAMPLE.walkTime ?? ''))
  const [shopCount, setShopCount] = useState(String(SAMPLE.shopCount ?? ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const data: MemorialData = {
    ...SAMPLE, routeName, rallyNo, area: area || undefined, type,
    walkTime: walkTime ? Number(walkTime) : undefined,
    shopCount: shopCount ? Number(shopCount) : undefined,
  }

  useEffect(() => {
    if (!canvasRef.current) return
    renderMemorial(canvasRef.current, data).catch((e) => setErr(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeName, rallyNo, area, type, walkTime, shopCount])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>기념품 티켓 — route-complete</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>SDS 스탬프 랠리 완주 티켓 · 1080x1350</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
          <label style={lbl}>루트명 <input value={routeName} onChange={(e) => setRouteName(e.target.value)} style={inp} /></label>
          <label style={lbl}>RALLY No. <input value={rallyNo} onChange={(e) => setRallyNo(e.target.value)} style={inp} /></label>
          <label style={lbl}>지역 <input value={area} onChange={(e) => setArea(e.target.value)} style={inp} /></label>
          <label style={lbl}>종류 <select value={type} onChange={(e) => setType(e.target.value as MemorialType)} style={inp}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label style={lbl}>도보(분) <input value={walkTime} onChange={(e) => setWalkTime(e.target.value)} style={inp} /></label>
          <label style={lbl}>샵 수 <input value={shopCount} onChange={(e) => setShopCount(e.target.value)} style={inp} /></label>
        </div>

        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 380, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.12)', display: 'block', margin: '0 auto 20px' }} />
        {err && <p style={{ color: 'crimson', fontSize: 13 }}>{err}</p>}

        <button disabled={busy}
          onClick={async () => { setBusy(true); setErr(null); try { await generateAndDownloadMemorial(data) } catch (e) { setErr(String(e)) } finally { setBusy(false) } }}
          style={{ width: '100%', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 13, cursor: 'pointer' }}>
          {busy ? '만드는 중...' : '티켓 다운로드 (PNG)'}
        </button>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, width: 240 }
