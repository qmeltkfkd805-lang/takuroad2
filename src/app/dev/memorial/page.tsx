'use client'
import { useEffect, useRef, useState } from 'react'
import { MemorialData, MemorialKind, RouteType, CollectionType } from '@/lib/memorial/types'
import { renderMemorial, generateAndDownloadMemorial } from '@/lib/memorial/generateMemorial'

const ROUTE_SAMPLE: MemorialData = {
  kind: 'route', rallyNo: '000128', title: '홍대 굿즈샵 한바퀴',
  area: '홍대', routeType: 'goods-shop-tour', walkTime: 42, shopCount: 5, date: '2026.07.15',
}
const COLLECTION_SAMPLE: MemorialData = {
  kind: 'collection', rallyNo: '000042', title: '주술회전 성지순례',
  collectionType: 'pilgrimage', shopCount: 8, date: '2026.07.15',
}

export default function MemorialDevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [kind, setKind] = useState<MemorialKind>('route')
  const [routeData, setRouteData] = useState(ROUTE_SAMPLE)
  const [colData, setColData] = useState(COLLECTION_SAMPLE)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const data = kind === 'route' ? routeData : colData

  useEffect(() => {
    if (!canvasRef.current) return
    renderMemorial(canvasRef.current, data).catch((e) => setErr(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, routeData, colData])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>기념품 티켓 — SDS</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>kind=template · 1080x1620 (2:3)</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['route', 'collection'] as MemorialKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: kind === k ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: kind === k ? '#FFEDE6' : '#fff', color: kind === k ? '#A23E18' : 'var(--text)' }}>
              {k}
            </button>
          ))}
        </div>

        {kind === 'route' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            <label style={lbl}>루트명 <input value={routeData.title} onChange={(e) => setRouteData({ ...routeData, title: e.target.value })} style={inp} /></label>
            <label style={lbl}>RALLY No. <input value={routeData.rallyNo} onChange={(e) => setRouteData({ ...routeData, rallyNo: e.target.value })} style={inp} /></label>
            <label style={lbl}>지역 <input value={routeData.area ?? ''} onChange={(e) => setRouteData({ ...routeData, area: e.target.value })} style={inp} /></label>
            <label style={lbl}>종류 <select value={routeData.routeType} onChange={(e) => setRouteData({ ...routeData, routeType: e.target.value as RouteType })} style={inp}>
              {(['goods-shop-tour','popup-tour','cafe-tour','mixed-tour'] as RouteType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select></label>
            <label style={lbl}>도보(분) <input value={routeData.walkTime ?? ''} onChange={(e) => setRouteData({ ...routeData, walkTime: Number(e.target.value) || undefined })} style={inp} /></label>
            <label style={lbl}>샵 수 <input value={routeData.shopCount ?? ''} onChange={(e) => setRouteData({ ...routeData, shopCount: Number(e.target.value) || undefined })} style={inp} /></label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            <label style={lbl}>컬렉션명 <input value={colData.title} onChange={(e) => setColData({ ...colData, title: e.target.value })} style={inp} /></label>
            <label style={lbl}>RALLY No. <input value={colData.rallyNo} onChange={(e) => setColData({ ...colData, rallyNo: e.target.value })} style={inp} /></label>
            <label style={lbl}>종류 <select value={colData.collectionType} onChange={(e) => setColData({ ...colData, collectionType: e.target.value as CollectionType })} style={inp}>
              {(['pilgrimage','goods','cafe','region'] as CollectionType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select></label>
            <label style={lbl}>도장 수 <input value={colData.shopCount ?? ''} onChange={(e) => setColData({ ...colData, shopCount: Number(e.target.value) || undefined })} style={inp} /></label>
          </div>
        )}

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
