/* ============================================================
   연간 리포트 공유 이미지 — 순수 Canvas 렌더러
   배경(정적 PNG)은 drawImage, 실제 데이터는 fillText로 합성.
   ⭐ 좌표는 1080 기준(스토리 1080×1920 / 피드 1080×1080). 프리뷰는 CSS로 축소.
   ⭐ 값 없는 항목은 그리지 않고 다음 블록이 위로 당겨진다(세로 흐름).
   ⭐ 배경·폰트는 프로젝트 정적 파일. 외부 URL 없음 → canvas taint 없음.
   ============================================================ */

import type { ReportCardData } from '@/services/yearlyReportService'

export const STORY_W = 1080, STORY_H = 1920
export const FEED_W = 1080, FEED_H = 1080

const CHARCOAL = '#3A3742'
const PINK = '#FF5692'
const MUTED = '#8C8894'
const CARD = 'rgba(255, 255, 255, 0.60)'
const CARD_BORDER = 'rgba(255, 86, 146, 0.35)'
const DASH = 'rgba(255, 86, 146, 0.28)'
const FAV_BG = 'rgba(180, 150, 220, 0.18)'

const TITLE = 'Cafe24Ssurround'                          // 제목·숫자
const BODY = 'Cafe24Ssurround, Pretendard, sans-serif'   // 본문(라벨·문구) — 써라운드로 통일(가독성), 없으면 Pretendard

/** 렌더 전에 폰트 로딩 보장 (누락 방지).
 *  ⭐ Cafe24 써라운드는 CSS 없이 FontFace API로 등록 → 전역 globals/CSS모듈 안 건드림. */
export async function ensureReportFonts(): Promise<void> {
  if (typeof document === 'undefined' || !(document as any).fonts) return
  const fs: any = (document as any).fonts
  // 리포트 전용 폰트: 써라운드(제목·본문 공용). woff2 없으면 ttf로 대체.
  const FACES = ['Cafe24Ssurround']
  try {
    for (const family of FACES) {
      let has = false
      try { fs.forEach((f: any) => { if (f.family === family) has = true }) } catch { /* noop */ }
      if (!has && typeof FontFace !== 'undefined') {
        try {
          const src = `url('/fonts/${family}.woff2') format('woff2'), url('/fonts/${family}.ttf') format('truetype')`
          const face = new FontFace(family, src, { weight: '100 900' } as any)
          await face.load()
          fs.add(face)
        } catch { /* 폰트 파일 없으면 무시(기본 폰트로 대체) */ }
      }
    }
    await Promise.all([
      fs.load('900 120px Cafe24Ssurround'),
      fs.load('700 32px Cafe24Ssurround'),
      fs.load('800 40px Pretendard'),
    ]).catch(() => {})
    await fs.ready
  } catch { /* 폰트 로딩 실패해도 기본 폰트로 진행 */ }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('bg load fail: ' + src))
    img.src = src
  })
}

/* ── 헬퍼 ── */
function font(weight: number | string, size: number, family: string) { return `${weight} ${size}px ${family}` }
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function dashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.save(); ctx.strokeStyle = DASH; ctx.lineWidth = 2; ctx.setLineDash([6, 7])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore()
}
/** 한 줄 자동 축소 + 말줄임. 실제 그린 fontSize 반환 */
function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number | string, maxW: number, startSize: number, minSize: number): { text: string; size: number } {
  let size = startSize
  ctx.font = font(weight, size, family)
  while (ctx.measureText(text).width > maxW && size > minSize) { size -= 2; ctx.font = font(weight, size, family) }
  if (ctx.measureText(text).width <= maxW) return { text, size }
  let t = text
  ctx.font = font(weight, minSize, family)
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return { text: t + '…', size: minSize }
}
function drawCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, weight: number | string, size: number, family: string, color: string, maxW?: number) {
  let t = text, s = size
  if (maxW) { const f = fitText(ctx, text, family, weight, maxW, size, Math.max(20, Math.round(size * 0.55))); t = f.text; s = f.size }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.font = font(weight, s, family)
  ctx.fillText(t, cx, y)
  return s
}

/* ── 큰 숫자(값+단위) 중앙 ── */
function drawStatCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, value: string, unit: string, label: string) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  // 값 + 단위 (한 덩어리로 중앙 정렬)
  ctx.font = font(800, 64, TITLE)
  const vw = ctx.measureText(value).width
  ctx.font = font(800, 30, BODY)
  const uw = ctx.measureText(unit).width
  const totalW = vw + 6 + uw
  const startX = cx - totalW / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = PINK
  ctx.font = font(800, 64, TITLE)
  ctx.fillText(value, startX, cy)
  ctx.fillStyle = PINK
  ctx.font = font(800, 30, BODY)
  ctx.fillText(unit, startX + vw + 6, cy)
  // 라벨
  ctx.textAlign = 'center'
  ctx.fillStyle = CHARCOAL
  ctx.font = font(600, 28, BODY)
  ctx.fillText(label, cx, cy + 42)
}

interface StatItem { value: string; unit: string; label: string }
function coreStats(d: ReportCardData): StatItem[] {
  const s: StatItem[] = [
    { value: String(d.visitedShopCount), unit: '곳', label: '방문한 샵' },
    { value: String(d.routesCompletedCount), unit: '개', label: '완주한 루트' },
  ]
  if (d.distanceKm != null) s.push({ value: d.distanceKm.toFixed(1), unit: 'km', label: '이동한 거리' })
  s.push({ value: String(d.badgesEarnedCount), unit: '개', label: '올해 획득 배지' })
  return s.slice(0, 4)
}

/* ── 2×2 통계 카드 ── */
function drawStatsCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, items: StatItem[]): number {
  const rows = Math.ceil(items.length / 2)
  const PADTOP = 80, PITCH = 152, BOTTOM = 62   // 행 간격을 넓혀 2행이 가운데 점선에 붙지 않게
  const h = PADTOP + (rows - 1) * PITCH + 42 + BOTTOM
  ctx.save()
  roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = CARD; ctx.fill()
  ctx.lineWidth = 2; ctx.strokeStyle = CARD_BORDER; ctx.stroke()
  ctx.restore()
  const colX = [x + w * 0.27, x + w * 0.73]
  const midY = y + PADTOP + PITCH / 2 - 8   // 두 행 사이 가로 점선(2행 값과 간격 확보)
  // 세로 점선
  dashedLine(ctx, x + w / 2, y + 34, x + w / 2, y + h - 34)
  for (let i = 0; i < items.length; i++) {
    const r = Math.floor(i / 2), c = i % 2
    const cy = y + PADTOP + r * PITCH
    drawStatCell(ctx, colX[c], cy, items[i].value, items[i].unit, items[i].label)
    if (r === 0 && rows > 1) dashedLine(ctx, x + 40, midY, x + w - 40, midY)
  }
  return h
}

/* ── 라벨 | 값 반투명 알약 행 ── */
function drawKvRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, bg = CARD): number {
  const h = 84
  ctx.save()
  roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = bg; ctx.fill()
  ctx.lineWidth = 2; ctx.strokeStyle = CARD_BORDER; ctx.stroke()
  ctx.restore()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = font(600, 28, BODY)
  ctx.fillText(label, x + 28, y + h / 2 + 2)
  const labelW = ctx.measureText(label).width
  ctx.textAlign = 'right'; ctx.fillStyle = PINK; ctx.font = font(800, 32, BODY)
  const maxValW = w - 28 - labelW - 60
  const f = fitText(ctx, value, BODY, 800, maxValW, 32, 20)
  ctx.font = font(800, f.size, BODY)
  ctx.fillText(f.text, x + w - 28, y + h / 2 + 2)
  ctx.textBaseline = 'alphabetic'
  return h
}

/* ── 최애 작품 박스 ── */
function drawFavBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, work: string): number {
  const h = 96
  ctx.save()
  roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = FAV_BG; ctx.fill()
  ctx.restore()
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED; ctx.font = font(700, 24, BODY)
  ctx.fillText('올해의 최애 작품', x + 26, y + 38)
  ctx.fillStyle = CHARCOAL; ctx.font = font(800, 40, BODY)
  const f = fitText(ctx, work, BODY, 800, w - 52, 40, 24)
  ctx.font = font(800, f.size, BODY)
  ctx.fillText(f.text, x + 26, y + 76)
  return h
}

/* ── 칭호 알약(중앙) ── */
function drawTitlePill(ctx: CanvasRenderingContext2D, cx: number, y: number, title: string): number {
  const h = 60
  ctx.font = font(800, 32, BODY)
  const f = fitText(ctx, title, BODY, 800, 620, 32, 22)
  ctx.font = font(800, f.size, BODY)
  const tw = ctx.measureText(f.text).width
  const w = tw + 60
  ctx.save()
  roundRect(ctx, cx - w / 2, y, w, h, 30); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
  ctx.lineWidth = 2; ctx.strokeStyle = PINK; ctx.stroke()
  ctx.restore()
  ctx.fillStyle = PINK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(f.text, cx, y + h / 2 + 2)
  ctx.textBaseline = 'alphabetic'
  return h
}

const MONTH_KO = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

/* ============================================================
   스토리 1080×1920
   ============================================================ */
export function drawStory(ctx: CanvasRenderingContext2D, bg: HTMLImageElement, d: ReportCardData) {
  ctx.clearRect(0, 0, STORY_W, STORY_H)
  ctx.drawImage(bg, 0, 0, STORY_W, STORY_H)
  const cx = STORY_W / 2

  drawCentered(ctx, 'TAKUROAD YEAR REPORT', cx, 258, 800, 30, BODY, PINK, 700)
  drawCentered(ctx, String(d.year), cx, 400, 900, 132, TITLE, CHARCOAL)
  drawCentered(ctx, '나의 타쿠로드', cx, 520, 900, 100, TITLE, CHARCOAL, 820)
  drawCentered(ctx, `${d.nickname}의 덕질 발자국`, cx, 596, 700, 42, BODY, CHARCOAL, 780)

  let y = 636
  if (d.title) { y += drawTitlePill(ctx, cx, y, d.title) + 26 } else { y += 8 }

  // 카드 폭을 우측 스티커(보라 노트 ≈x925~)에 물리지 않게 조금 좁힌다
  const cardX = 160, cardW = 760
  y += drawStatsCard(ctx, cardX, y, cardW, coreStats(d)) + 28

  if (d.topRegion) y += drawKvRow(ctx, cardX, y, cardW, '올해 가장 많이 간 지역', d.topRegion) + 14
  if (d.mostActiveMonth) y += drawKvRow(ctx, cardX, y, cardW, '가장 활발했던 달', MONTH_KO[d.mostActiveMonth]) + 14
  if (d.favoriteWork) y += drawFavBox(ctx, cardX, y, cardW, d.favoriteWork) + 14

  // 하단 마무리 문구 — 좌하단 캐릭터와 우하단 가챠 사이 빈 통로(중앙보다 살짝 오른쪽)에 배치
  const fcx = 648
  ctx.textAlign = 'center'
  ctx.fillStyle = CHARCOAL; ctx.font = font(700, 34, BODY)
  ctx.fillText('좋아하는 마음이', fcx, 1604)
  ctx.fillText('나를 여기까지 데려왔어요.', fcx, 1656)
  drawCentered(ctx, `TAKUROAD · ${d.year}`, fcx, 1730, 700, 26, BODY, PINK)
  ctx.textAlign = 'left'
}

/* ============================================================
   피드 1080×1080 — 핵심만. 우하단 캐릭터 영역(≈x760~) 침범 주의.
   ============================================================ */
export function drawFeed(ctx: CanvasRenderingContext2D, bg: HTMLImageElement, d: ReportCardData) {
  ctx.clearRect(0, 0, FEED_W, FEED_H)
  ctx.drawImage(bg, 0, 0, FEED_W, FEED_H)
  const cx = FEED_W / 2

  drawCentered(ctx, 'TAKUROAD YEAR REPORT', cx, 150, 800, 26, BODY, PINK, 600)
  drawCentered(ctx, `${d.year} 나의 타쿠로드`, cx, 224, 900, 72, TITLE, CHARCOAL, 840)
  drawCentered(ctx, `${d.nickname}의 덕질 발자국`, cx, 280, 700, 34, BODY, CHARCOAL, 700)

  let y = 310
  if (d.title) { y += drawTitlePill(ctx, cx, y, d.title) + 18 } else { y += 4 }

  // 통계카드: 좌측 스티커(≈x180)·우측 쇼핑백(≈x935) 사이 안전영역
  const cardX = 178, cardW = 730
  y += drawStatsCard(ctx, cardX, y, cardW, coreStats(d)) + 18

  // 보조 정보는 1줄만(피드는 핵심 요약). 우하단 캐릭터(≈x730~)·좌측 스티커를 피해 폭을 좁힌다.
  const secX = 178, secW = 524
  if (d.favoriteWork) y += drawFavBox(ctx, secX, y, secW, d.favoriteWork) + 10
  else if (d.topRegion) y += drawKvRow(ctx, secX, y, secW, '가장 많이 간 곳', d.topRegion) + 10

  ctx.textAlign = 'left'
  ctx.fillStyle = MUTED; ctx.font = font(700, 25, BODY)
  ctx.fillText(`좋아하는 마음이 만든 ${d.year}년의 발자국`, secX + 2, Math.min(y + 40, 905))
}
