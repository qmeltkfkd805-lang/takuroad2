'use client'
import { CSSProperties } from 'react'
import { Icon } from './Icon'

export type ActivityKind =
  | 'popup' | 'cafe' | 'exhibition'
  | 'active' | 'goods' | 'news' | 'shops'
  | 'waiting' | 'quiet'

export interface ActivityItem {
  kind: ActivityKind
  count?: number
}

export const TIER1: ActivityKind[] = ['popup', 'cafe', 'exhibition']

type Tone = 'accent' | 'muted' | 'faint'

const META: Record<ActivityKind, { icon: string | null; tone: Tone; text: string; countSuffix?: string }> = {
  popup:      { icon: 'event',      tone: 'accent', text: '팝업 진행중' },
  cafe:       { icon: 'cafe',       tone: 'accent', text: '콜라보 카페 운영중' },
  exhibition: { icon: 'exhibition', tone: 'accent', text: '전시회 진행중' },
  active:     { icon: 'fire',       tone: 'muted',  text: '오늘 활발해요' },
  goods:      { icon: 'goods',      tone: 'muted',  text: '신상 굿즈', countSuffix: '개' },
  news:       { icon: 'news',       tone: 'muted',  text: '새로운 소식', countSuffix: '개' },
  shops:      { icon: 'shop',       tone: 'muted',  text: '취급샵', countSuffix: '곳' },
  waiting:    { icon: null,         tone: 'faint',  text: '새로운 소식을 기다리는 중' },
  quiet:      { icon: null,         tone: 'faint',  text: '오늘은 조용해요' },
}

const TONE_COLOR: Record<Tone, string> = { accent: '#FF8B66', muted: '#9B968D', faint: '#B0ABA2' }

interface ActivityBadgeProps {
  kind: ActivityKind
  count?: number
  style?: CSSProperties
}

export function ActivityBadge({ kind, count, style }: ActivityBadgeProps) {
  const m = META[kind]
  const color = TONE_COLOR[m.tone]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color, fontWeight: m.tone === 'accent' ? 700 : 400, ...style }}>
      {m.icon && <Icon name={m.icon} size={15} />}
      {m.countSuffix ? (
        <span>{m.text} <b style={{ color: 'var(--text)', fontWeight: 700 }}>{count ?? 0}</b>{m.countSuffix}</span>
      ) : (
        <span>{m.text}</span>
      )}
    </span>
  )
}
