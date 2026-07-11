'use client'
import { CSSProperties } from 'react'

/* ============================================================
   LineIcon — 앱 전역 인라인 SVG 아이콘 (TDS)

   ⭐ 이모지 금지. OS마다 모양이 달라지고, 색을 못 맞추고, 정렬이 폰트에 휘둘린다.
   ⭐ stroke="currentColor" — 부모 색을 따라간다 (칩이 선택되면 아이콘도 같이 물든다)

   ⚠️⚠️ 새 아이콘을 여기서 직접 "그리지 말 것".
      public/icons/ 에 이미 만들어둔 자산(70+개)이 있다. 손으로 그린 SVG는 그 자산과
      선 두께·비율·성격이 안 맞아서 UI가 튄다. 필요한 아이콘은 먼저 public/icons/ 를 볼 것.
      - public/icons/*.png (라인아트, 투명) → mask로 색칠해서 사용 (MaskIcon)
      - public/icons/color*.png (컬러)      → TDS Icon(<img>)으로 그대로 사용
      LineIcon은 자산에 없는 UI 글리프(화살표·체크 등)에만 쓴다.

   ⚠️ 옛 EventIcon은 이 파일의 얇은 래퍼로 남아 있다(기존 12개 파일 호환용).
      새 코드는 LineIcon을 직접 쓸 것.
   ============================================================ */

export type LineIconName =
  | 'pin' | 'work' | 'party' | 'fire' | 'clock' | 'calendar' | 'calendarPlus'
  | 'heart' | 'tag' | 'ticket' | 'bag' | 'chat' | 'star' | 'starFill' | 'link' | 'sparkle'

interface Props {
  name: LineIconName
  size?: number
  color?: string
  style?: CSSProperties
  className?: string
}

const PATHS: Record<LineIconName, React.ReactNode> = {
  pin: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  work: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v14M16 5v14M3 9.5h5M3 14.5h5M16 9.5h5M16 14.5h5" /></>,
  party: <><path d="M4.5 20.5 9 9l6 6-11.5 4.5Z" /><path d="m14 7 1-2M17 10l2-1M15.5 4.5 16 3M20 12.5l1.5.5M18.5 6.5 20 5" /></>,
  fire: <><path d="M12 3s4 3.5 4 7a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9.5 9 12 7 12 3Z" /><path d="M7.5 12A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 4.5-9" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></>,
  calendarPlus: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3M12 13v5M9.5 15.5h5" /></>,
  heart: <path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6c0 5-7 9.4-7 9.4Z" />,
  tag: <><path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-6.7 6.7a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" /><circle cx="8" cy="8" r="1.4" /></>,
  ticket: <><path d="M3.5 8.5V6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V13.5a2.5 2.5 0 0 0 0-5Z" /><path d="M14 6v12" strokeDasharray="2 2.5" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  chat: <><path d="M20.5 12.5c0 4-3.8 7-8.5 7a10 10 0 0 1-2.6-.3L4 21l1.3-3.6A6.7 6.7 0 0 1 3.5 12.5c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z" /></>,
  star: <path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9L9.5 9 12 4Z" />,
  starFill: <path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9L9.5 9 12 4Z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 1 0 5.7 5.7l1.3-1.3" /></>,
  sparkle: <><path d="M12 4v5M12 15v5M4.5 12h5M14.5 12h5" /><path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" /></>,

}

export function LineIcon({ name, size = 18, color, style, className }: Props) {
  const filled = name === 'starFill'
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: color ?? 'currentColor', flexShrink: 0, display: 'block', ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

export default LineIcon
