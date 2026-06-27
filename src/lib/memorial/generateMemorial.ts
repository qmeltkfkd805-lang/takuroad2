'use client'
import { MemorialData, MemorialAssets, MEMORIAL_W, MEMORIAL_H } from './types'
import { TEMPLATES } from './templates'
import { loadImage, loadImagesOptional, ensureFont } from './canvasHelpers'

const KIND_SUFFIX: Record<string, string> = {
  'route-complete': '완주기념',
  'collection-complete': '컬렉션기념',
  'first-checkin': '첫방문기념',
  'year-report': '연말기념',
}

function memorialFilename(data: MemorialData): string {
  const clean = data.routeName.replace(/\s+/g, '')
  const suffix = KIND_SUFFIX[data.kind] ?? '기념'
  return `TAKUROAD_${clean}_${suffix}.png`
}

export interface Memorial {
  blob: Blob
  dataUrl: string
  filename: string
  download: () => void
  share: () => Promise<boolean>
  copyToClipboard: () => Promise<boolean>
  canShare: () => boolean
}

function makeMemorial(blob: Blob, dataUrl: string, filename: string): Memorial {
  const file = () => new File([blob], filename, { type: 'image/png' })

  const download = () => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canShare = () => {
    const nav = navigator as any
    return !!nav.share && (!nav.canShare || nav.canShare({ files: [file()] }))
  }

  const share = async (): Promise<boolean> => {
    const nav = navigator as any
    if (!nav.share) return false
    try {
      await nav.share({ files: [file()], title: 'TAKUROAD', text: '타쿠로드 완주 기념 티켓' })
      return true
    } catch { return false }
  }

  const copyToClipboard = async (): Promise<boolean> => {
    try {
      const cb = navigator.clipboard as any
      if (!cb?.write || typeof ClipboardItem === 'undefined') return false
      await cb.write([new ClipboardItem({ 'image/png': blob })])
      return true
    } catch { return false }
  }

  return { blob, dataUrl, filename, download, share, copyToClipboard, canShare }
}

export async function renderMemorial(canvas: HTMLCanvasElement, data: MemorialData, scale = 1): Promise<void> {
  const template = TEMPLATES[data.kind]
  if (!template) throw new Error(`기념품 템플릿 없음: ${data.kind}`)

  await ensureFont('Gaegu', '/fonts/Gaegu-Bold.ttf')

  canvas.width = MEMORIAL_W * scale
  canvas.height = MEMORIAL_H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context 없음')
  if (scale !== 1) ctx.scale(scale, scale)

  const assets = await loadAssets(data)
  template(ctx, data, assets)
}

async function loadAssets(data: MemorialData): Promise<MemorialAssets> {
  const logo = await loadImage('/brand/takuroad-logo.png')
  const optional = await loadImagesOptional({
    stamp: data.stampKind ? `/stamps/${data.stampKind}.png` : undefined,
    taku: data.takuPose ? `/taku/taku-${data.takuPose}.png` : undefined,
    iconMap: '/icons/map.png',
    iconShop: '/icons/shop.png',
    iconClock: '/icons/clock.png',
  })
  return {
    logo, stamp: optional.stamp, taku: optional.taku,
    iconMap: optional.iconMap, iconShop: optional.iconShop, iconClock: optional.iconClock,
  }
}

export async function generateMemorial(data: MemorialData, scale = 1): Promise<Memorial> {
  const canvas = document.createElement('canvas')
  await renderMemorial(canvas, data, scale)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Blob 생성 실패'))), 'image/png')
  })
  const dataUrl = canvas.toDataURL('image/png')
  return makeMemorial(blob, dataUrl, memorialFilename(data))
}

export async function generateAndDownloadMemorial(data: MemorialData): Promise<Memorial> {
  const memorial = await generateMemorial(data)
  memorial.download()
  return memorial
}
