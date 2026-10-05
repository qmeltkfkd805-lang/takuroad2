'use client'

import { useWorn } from './CosmeticProvider'
import styles from './UserFace.module.css'

/* 사람의 "얼굴" — 아바타 + 칭호
   (2026-10: 프로필 프레임·효과는 없앴다. 칭호만 남는다)

   ⭐ 코스메틱은 /cosmetic에서만 보이면 의미가 없다.
      남이 봐야 꾸미는 동기가 생긴다. 그래서 이 컴포넌트를
      탑바·사이드바·프로필·커뮤니티·리뷰·연대기 어디에나 꽂는다.

   ⭐ 데이터는 CosmeticProvider가 배치로 가져온다. 쓰는 쪽은 아무것도 안 해도 된다. */

interface AvatarProps {
  userId?: string | null
  src?: string | null
  name?: string | null
  size?: number
  /** @deprecated 프로필 효과를 없애서 아무 일도 안 한다 (예전 호출부 호환용) */
  showEffect?: boolean
  className?: string
}

// userId 는 예전 호출부 호환용 (프레임·효과가 없어져 아바타엔 더 쓰지 않음)
export function UserAvatar({ src, name, size = 40, className }: AvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${className ?? ''}`}
      style={{ width: size, height: size }}
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
export function UserLine({ userId, src, name, size = 36 }: AvatarProps) {
  return (
    <span className={styles.line}>
      <UserAvatar userId={userId} src={src} name={name} size={size} />
      <span className={styles.lineBody}>
        <span className={styles.nick}>{name ?? '익명'}</span>
        <UserTitle userId={userId} />
      </span>
    </span>
  )
}
