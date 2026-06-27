'use client'
import {
  MemorialTemplate, MEMORIAL_W as W, MEMORIAL_H as H,
  KIND_INK,
} from '../types'
import { drawStampTinted, drawStampbookPaper } from '../canvasHelpers'
import { pickMainMessage, pickSubMessage, varsFromData } from '../messages'

const BASE = `'Noto Sans KR','Pretendard',sans-serif`
const HAND = `'Gaegu','Noto Sans KR',sans-serif`
const PAPER = '#F3ECD8', INKBLACK = '#26221E', MUTED = '#7A7260'

const L = {
  lineTopY: 250, lineBotY: H - 250,
  headerY1: 120, headerY2: 180,
  titleY: 310, titlePx: 92, titleMaxW: W - 200,
  stampSize: 600, stampCx: W / 2, stampCy: 760, stampRot: -10, stampOpacity: 0.92,
  completeY: 1130, completePx: 40,
  mainY: 1210, subY: 1256,
  compNoY: H - 190, dateY: H - 145, urlY: H - 90,
}

export const collection: MemorialTemplate = (ctx, data, assets) => {
  const ink = KIND_INK[data.kind]

  drawStampbookPaper(ctx, W, H, PAPER)
  vignette(ctx)

  ctx.strokeStyle = INKBLACK
  ctx.lineWidth = 5
  hline(ctx, 90, W - 90, L.lineTopY)
  hline(ctx, 90, W - 90, L.lineBotY)
  ctx.lineWidth = 2
  hline(ctx, 90, W - 90, L.lineTopY + 12)
  hline(ctx, 90, W - 90, L.lineBotY + 12)

  centerText(ctx, 'TAKUROAD', W / 2, L.headerY1, `900 48px ${BASE}`, INKBLACK)
  centerText(ctx, 'COLLECTION', W / 2, L.headerY2, `900 26px ${BASE}`, ink.main)

  centerText(ctx, data.title, W / 2, L.titleY, `700 ${L.titlePx}px ${HAND}`, INKBLACK, L.titleMaxW)

  if (assets.stamp) {
    drawStampTinted(ctx, assets.stamp, L.stampCx, L.stampCy, L.stampSize, L.stampRot, ink.main, L.stampOpacity)
  }

  centerText(ctx, 'THIS PAGE IS COMPLETE', W / 2, L.completeY, `900 ${L.completePx}px ${BASE}`, ink.main)
  centerText(ctx, pickMainMessage(data.kind, data.rallyNo), W / 2, L.mainY, `700 30px ${BASE}`, MUTED)
  const subLines = pickSubMessage(data.kind, data.rallyNo, varsFromData(data))
  if (subLines.length) centerText(ctx, subLines.join(' '), W / 2, L.subY, `700 28px ${BASE}`, MUTED)

  if (data.shopCount !== undefined) {
    centerText(ctx, `${data.shopCount} / ${data.shopCount}  COMPLETE`, W / 2, L.compNoY, `900 28px ${BASE}`, ink.main)
  }
  if (data.date) centerText(ctx, data.date, W / 2, L.dateY, `700 28px ${BASE}`, MUTED)
  centerText(ctx, 'takuroad.kr', W / 2, L.urlY, `700 24px ${BASE}`, INKBLACK)
}

function vignette(ctx) {
  ctx.save()
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.62)
  g.addColorStop(0, 'rgba(60,45,20,0)')
  g.addColorStop(1, 'rgba(60,45,20,0.08)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

function hline(ctx, x1, x2, y) {
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
}

function centerText(ctx, text, cx, y, font, color, maxW) {
  ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  if (maxW) {
    let px = parseInt(font.match(/(\d+)px/)?.[1] ?? '40', 10)
    while (ctx.measureText(text).width > maxW && px > 20) { px -= 2; ctx.font = font.replace(/\d+px/, `${px}px`) }
  }
  ctx.fillText(text, cx, y); ctx.restore()
}

