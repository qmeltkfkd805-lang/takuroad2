'use client'
import {
  MemorialTemplate, MEMORIAL_W as W, MEMORIAL_H as H,
  KIND_INK, ROUTE_TYPE_LABEL,
} from '../types'
import {
  drawStampTinted, drawCrumpledPaper, wobblyLine, dashedH, dashedV,
  doodleStar, roundRectPath,
} from '../canvasHelpers'

const BASE = `'Noto Sans KR','Pretendard',sans-serif`
const HAND = `'Gaegu','Noto Sans KR',sans-serif`
const PAPER = '#FAF7EE', INKBLACK = '#26221E', MUTED = '#6E685F'

const L = {
  radius: 28, perfX: 100,
  serialY: 90,
  headerY1: 120, headerY2: 192, headerY3: 252,
  ribbonY: 322,
  specialCx: W - 200, specialCy: 116,
  stampSize: 580, stampCx: W / 2 + 20, stampCy: 640, stampRot: -16, stampOpacity: 0.88,
  titleY: 885, titlePx: 110, titleMaxW: W - 220,
  underlineY: 995,
  infoY: 1140, infoIconSize: 42,
  dateY: 1250,
  perfBottomY: H - 150,
  urlY: H - 110,
}

export const route: MemorialTemplate = (ctx, data, assets) => {
  const ink = KIND_INK[data.kind]

  ctx.save()
  roundRectPath(ctx, 0, 0, W, H, L.radius)
  ctx.clip()
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  drawCrumpledPaper(ctx, W, H)
  ctx.restore()

  dashedV(ctx, L.perfX, 80, H - 80, INKBLACK, 4, 5)
  dashedH(ctx, L.perfBottomY, 160, W - 100, INKBLACK, 4, 11)

  ctx.save()
  ctx.translate(L.perfX / 2, L.serialY)
  ctx.rotate(Math.PI / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.font = `700 26px ${BASE}`; ctx.fillStyle = INKBLACK
  ctx.fillText('RALLY No.', 0, 0)
  ctx.font = `900 30px ${BASE}`; ctx.fillStyle = ink.main
  ctx.fillText(data.rallyNo, 170, 0)
  ctx.restore()

  centerText(ctx, 'TAKUROAD', W / 2, L.headerY1, `900 54px ${BASE}`, INKBLACK)
  centerText(ctx, 'OFFICIAL', W / 2, L.headerY2, `900 28px ${BASE}`, INKBLACK)
  wobblyLine(ctx, W / 2 - 78, L.headerY2 + 38, W / 2 + 78, L.headerY2 + 38, INKBLACK, 3, 1.5, 16, 3)
  centerText(ctx, 'STAMP RALLY', W / 2, L.headerY3, `900 58px ${BASE}`, INKBLACK)
  doodleStar(ctx, 335, 150, 20, INKBLACK, 3)
  doodleStar(ctx, W - 345, 150, 20, INKBLACK, 3)

  ctx.font = `900 36px ${BASE}`
  const rtw = ctx.measureText('완주 티켓').width
  centerText(ctx, '완주 티켓', W / 2, L.ribbonY, `900 36px ${BASE}`, INKBLACK)
  ctx.strokeStyle = ink.main; ctx.lineWidth = 3
  straight(ctx, W / 2 - rtw / 2 - 70, L.ribbonY + 20, W / 2 - rtw / 2 - 20, L.ribbonY + 20)
  straight(ctx, W / 2 + rtw / 2 + 20, L.ribbonY + 20, W / 2 + rtw / 2 + 70, L.ribbonY + 20)

  ctx.save()
  ctx.translate(L.specialCx, L.specialCy)
  ctx.rotate((11 * Math.PI) / 180)
  wobblyLine(ctx, -130, -52, 130, -52, ink.main, 4, 2, 14, 30)
  wobblyLine(ctx, 130, -52, 130, 52, ink.main, 4, 2, 14, 31)
  wobblyLine(ctx, 130, 52, -130, 52, ink.main, 4, 2, 14, 32)
  wobblyLine(ctx, -130, 52, -130, -52, ink.main, 4, 2, 14, 33)
  ctx.fillStyle = ink.main; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 34px ${BASE}`
  ctx.fillText('SPECIAL', 0, -22)
  ctx.fillText('ROUTE', 0, 20)
  ctx.restore()

  if (assets.stamp) {
    drawStampTinted(ctx, assets.stamp, L.stampCx, L.stampCy, L.stampSize, L.stampRot, ink.main, L.stampOpacity)
  }

  centerText(ctx, data.title, W / 2, L.titleY, `700 ${L.titlePx}px ${HAND}`, INKBLACK, L.titleMaxW)
  wobblyLine(ctx, 180, L.underlineY, W - 180, L.underlineY, ink.main, 5, 2.5, 18, 40)
  doodleStar(ctx, W - 130, L.titleY - 20, 18, ink.main, 3)

  drawInfoRow(ctx, data, assets)

  if (data.date) centerText(ctx, data.date, W / 2, L.dateY, `700 34px ${BASE}`, MUTED)
  centerText(ctx, 'takuroad.kr', W / 2, L.urlY, `700 26px ${BASE}`, INKBLACK)
}

function drawInfoRow(ctx: CanvasRenderingContext2D, data: Parameters<MemorialTemplate>[1], assets: Parameters<MemorialTemplate>[2]) {
  const items = []
  if (data.area && assets.iconMap) items.push({ icon: assets.iconMap, text: data.area })
  if (data.routeType && assets.iconShop) items.push({ icon: assets.iconShop, text: ROUTE_TYPE_LABEL[data.routeType] })
  if (data.walkTime !== undefined && assets.iconClock) items.push({ icon: assets.iconClock, text: `${data.walkTime} min` })

  const sz = L.infoIconSize, gapIV = 16, gapItem = 56
  ctx.font = `700 30px ${BASE}`
  const widths = items.map((it) => sz + gapIV + ctx.measureText(it.text).width)
  const total = widths.reduce((a, b) => a + b, 0) + gapItem * (items.length - 1)
  let x = W / 2 - total / 2
  const y = L.infoY
  items.forEach((it, i) => {
    if (it.icon) ctx.drawImage(it.icon, x, y, sz, sz)
    ctx.fillStyle = INKBLACK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.font = `700 30px ${BASE}`
    ctx.fillText(it.text, x + sz + gapIV, y + sz / 2)
    x += widths[i] + gapItem
  })
}

function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, font: string, color: string, maxW?: number) {
  ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  if (maxW) {
    let px = parseInt(font.match(/(\d+)px/)?.[1] ?? '40', 10)
    while (ctx.measureText(text).width > maxW && px > 20) { px -= 2; ctx.font = font.replace(/\d+px/, `${px}px`) }
  }
  ctx.fillText(text, cx, y); ctx.restore()
}

function straight(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}
