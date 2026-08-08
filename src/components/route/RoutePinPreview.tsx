'use client'
/* 경량 루트 미리보기 — 실제 지도 대신 좌표를 정규화해 핑크 경로선 + 번호 핀만 그린다.
   카카오 로고/과금 없음. 실제 확대·이동 지도는 상세·지도 보기 화면에서만 사용.
   좌표가 없으면 기존 지도 placeholder(임의 좌표 생성 안 함). */
import styles from './RoutePinPreview.module.css'

type Stop = { lat: number; lng: number }

export default function RoutePinPreview({ stops, height = 118 }: { stops: Stop[]; height?: number }) {
  const pts = (stops ?? []).filter(s => typeof s?.lat === 'number' && typeof s?.lng === 'number')

  if (pts.length === 0) {
    return (
      <div className={styles.placeholder} style={{ height }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c3cad3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3z" /><path d="M9 7v13M15 4v13" />
        </svg>
      </div>
    )
  }

  const lngs = pts.map(p => p.lng), lats = pts.map(p => p.lat)
  const minX = Math.min(...lngs), maxX = Math.max(...lngs)
  const minY = Math.min(...lats), maxY = Math.max(...lats)
  const spanX = maxX - minX, spanY = maxY - minY
  const pad = 0.17
  const pos = pts.map(p => ({
    x: pts.length === 1 ? 0.5 : pad + (1 - 2 * pad) * (spanX ? (p.lng - minX) / spanX : 0.5),
    y: pts.length === 1 ? 0.5 : pad + (1 - 2 * pad) * (spanY ? 1 - (p.lat - minY) / spanY : 0.5),
  }))
  const line = pos.map(p => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`).join(' ')

  const big = height >= 100
  const pinSize = big ? 22 : 15
  const fontSize = big ? 11 : 9

  return (
    <div className={styles.wrap} style={{ height }}>
      <svg className={styles.grid} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <rect x="8" y="58" width="28" height="24" className={styles.park} />
        <rect x="60" y="10" width="26" height="22" className={styles.block} />
        <rect x="46" y="70" width="30" height="24" className={styles.block} />
        {[20, 40, 60, 80].map(v => <line key={'h' + v} x1="0" y1={v} x2="100" y2={v} className={styles.gline} />)}
        {[20, 40, 60, 80].map(v => <line key={'v' + v} x1={v} y1="0" x2={v} y2="100" className={styles.gline} />)}
      </svg>

      {pos.length > 1 && (
        <svg className={styles.line} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={line} className={styles.under} />
          <polyline points={line} className={styles.path} />
        </svg>
      )}

      {pos.map((p, i) => (
        <span key={i} className={styles.pin}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: pinSize, height: pinSize, fontSize }}>
          {i + 1}
        </span>
      ))}
    </div>
  )
}
