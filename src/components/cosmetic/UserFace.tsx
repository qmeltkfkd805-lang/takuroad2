'use client'

import { useWorn } from './CosmeticProvider'
import { FRAME_STYLE, fxClass } from '@/lib/cosmetics/style'
import styles from './UserFace.module.css'

/* 사람의 "얼굴" — 아바타(프레임·효과) + 칭호

   ⭐ 코스메틱은 /cosmetic에서만 보이면 의미가 없다.
      남이 봐야 꾸미는 동기가 생긴다. 그래서 이 컴포넌트를
      탑바·사이드바·프로필·커뮤니티·리뷰·연대기 어디에나 꽂는다.

   ⭐ 데이터는 CosmeticProvider가 배치로 가져온다. 쓰는 쪽은 아무것도 안 해도 된다. */

interface AvatarProps {
  userId?: string | null
  src?: string | null
  name?: string | null
  size?: number
  /** 효과(반짝이·오라 등)까지 보여줄지. 작은 자리에선 끈다 */
  showEffect?: boolean
  className?: string
}

export function UserAvatar({ userId, src, name, size = 40, showEffect = true, className }: AvatarProps) {
  const worn = useWorn(userId)
  const frame = worn.frame ? FRAME_STYLE[worn.frame.slug] : undefined
  const fx = showEffect ? fxClass(worn.effect?.slug) : ''

  return (
    <span
      className={`${styles.avatar} ${fx ? styles[fx] : ''} ${className ?? ''}`}
      style={{ width: size, height: size, ...frame }}
    >
      {src
        ? <img src={src} alt="" />
        : <span className={styles.initial} style={{ fontSize: size * 0.42 }}>
            {(name ?? '?').slice(0, 1)}
          </span>}
    </span>
  )
}

/** 칭호 — 닉네임 옆에 */
export function UserTitle({ userId, size = 'sm' }: { userId?: string | null; size?: 'sm' | 'md' }) {
  const worn = useWorn(userId)
  if (!worn.title) return null
  return (
    <span className={`${styles.title} ${size === 'md' ? styles.titleMd : ''}`}>
      {worn.title.name}
    </span>
  )
}

/** 아바타 + 닉네임 + 칭호 한 줄 — 커뮤니티·리뷰에서 제일 많이 쓴다 */
export function UserLine({ userId, src, name, size = 36, showEffect = false }: AvatarProps) {
  return (
    <span className={styles.line}>
      <UserAvatar userId={userId} src={src} name={name} size={size} showEffect={showEffect} />
      <span className={styles.lineBody}>
        <span className={styles.nick}>{name ?? '익명'}</span>
        <UserTitle userId={userId} />
      </span>
    </span>
  )
}
