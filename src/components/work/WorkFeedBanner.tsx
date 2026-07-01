'use client'

import Link from 'next/link'
import { FeedItem, FeedTone } from '@/lib/feed/types'

const TONE: Record<FeedTone, { bg: string; fg: string }> = {
  coral: { bg: '#FFEDE6', fg: '#C0392B' },
  blue: { bg: '#E8F4FF', fg: '#1A5F95' },
  mint: { bg: '#E1F7F2', fg: '#0E7A63' },
  gold: { bg: '#FFF3D6', fg: '#946400' },
  lavender: { bg: '#F0ECFF', fg: '#5A43B5' },
  gray: { bg: '#F1EFEA', fg: '#8A857C' },
}

const KIND_BADGE: Record<string, { label: string; dot: string }> = {
  event: { label: '새 이벤트', dot: '#FF5692' },
  goods: { label: '굿즈 입고', dot: '#F5A300' },
  popup: { label: '팝업 진행', dot: '#3B9BE8' },
  route: { label: '새 루트', dot: '#1FAE8C' },
  collection: { label: '컬렉션', dot: '#8B6BD9' },
  checkin: { label: '체크인', dot: '#3B9BE8' },
  notice: { label: '업데이트', dot: '#1FAE8C' },
  none: { label: '새 소식', dot: '#C7C2BA' },
}

export default function WorkFeedBanner({ item }: { item: FeedItem }) {
  const tone = TONE[item.tone]
  const badge = KIND_BADGE[item.kind] ?? KIND_BADGE.none

  const inner = (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden', minHeight: 130,
      cursor: item.href ? 'pointer' : 'default',
    }}>
      <div style={{
        flex: '0 0 42%', maxWidth: 280, position: 'relative',
        background: item.imageUrl ? undefined : tone.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
          : <span style={{ color: tone.fg, fontSize: 28, fontWeight: 800 }}>{(item.contextLabel ?? '').slice(0, 2)}</span>}
      </div>
      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        {item.contextLabel && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{item.contextLabel}</div>}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          background: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 800,
          padding: '4px 10px', borderRadius: 9999,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: badge.dot }} />
          {badge.label}
        </span>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35 }}>{item.title}</div>
        {item.subtitle && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.subtitle}</div>}
      </div>
    </div>
  )

  return item.href ? <Link href={item.href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}
