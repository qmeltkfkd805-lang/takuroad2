'use client'
import { CSSProperties } from 'react'
import { LineIcon, LineIconName } from '@/components/tds/LineIcon'

/* ============================================================
   ⚠️ EventIcon은 TDS LineIcon으로 승격됐다 (2026-07-11).

   이 파일은 **기존 12개 파일(event·shop·place)을 안 건드리기 위한 얇은 래퍼**다.
   아이콘 정의는 전부 components/tds/LineIcon.tsx 하나에 있다.

   새 코드는 LineIcon을 직접 쓸 것:
     import { LineIcon } from '@/components/tds'

   (SNS 브랜드 로고는 벡터로 다시 그리지 않으므로 여기 그대로 둔다 — PNG 자산)
   ============================================================ */

export type EventIconName = LineIconName

interface Props {
  name: EventIconName
  size?: number
  color?: string
  style?: CSSProperties
}

export function EventIcon({ name, size = 18, color, style }: Props) {
  return <LineIcon name={name} size={size} color={color} style={style} />
}

/** 브랜드 로고는 다시 그리지 않는다 — 실제 파일을 쓴다 */
export const SNS_ICON: { match: string; src: string; label: string }[] = [
  { match: 'instagram', src: '/icons/instargram.png', label: '인스타그램' },
  { match: 'twitter',   src: '/icons/X.png',          label: 'X(트위터)' },
  { match: 'x.com',     src: '/icons/X.png',          label: 'X(트위터)' },
  { match: 'kakao',     src: '/icons/kakao.png',      label: '카카오' },
]
export function snsMeta(url: string) {
  return SNS_ICON.find(m => url.toLowerCase().includes(m.match))
    ?? { src: '/icons/homepage.png', label: '링크' }
}
