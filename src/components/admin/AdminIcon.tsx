'use client'
import { CSSProperties } from 'react'

/* ============================================================
   AdminIcon — 관리자 화면 전용 outline 아이콘 (24x24, stroke 기반)

   왜 따로 두는가:
   - TDS의 LineIcon은 도메인 글리프 16개뿐이라 관리자 UI에 필요한
     shield·flag·mail·handshake·settings 등이 없다.
   - LineIcon 파일에는 "여기서 새 아이콘을 직접 그리지 말 것"이라고 못박혀 있고,
     public/icons/*.png(마스크 아이콘)는 선 두께·비율이 달라 섞으면 UI가 튄다.
   => 그래서 관리자 화면 안에서만 쓰는 한 벌을 여기에 모았다.
      사용자 사이트와 TDS는 건드리지 않는다.

   컴포넌트는 이 하나뿐이다. 새 아이콘이 필요하면 PATHS에 d 값만 추가한다.
   (아이콘마다 별도 컴포넌트를 만들지 말 것)
   ============================================================ */

export type AdminIconName =
  // 사이드바
  | 'dashboard' | 'hero' | 'work' | 'shop' | 'place' | 'route' | 'season'
  | 'approve' | 'verify' | 'flagShop' | 'flagPost'
  | 'member' | 'contact' | 'partner' | 'idea'
  | 'external' | 'settings' | 'chevron' | 'menu' | 'close'
  // 대시보드
  | 'inbox' | 'visitor' | 'userPlus' | 'checkin' | 'alert' | 'arrowRight'
  | 'search' | 'edit' | 'doc' | 'checkCircle'

/** 24x24 뷰박스 기준 path 데이터. 전부 stroke, fill 없음 */
const PATHS: Record<AdminIconName, string> = {
  dashboard: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M9.5 20v-6h5v6',
  hero:      'm12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 19.6l1.1-6L3.4 9.4l6-.8z',
  work:      'M3 5.5h18v13H3zM3 9.5h18M8 5.5v4M16 5.5v4M8 18.5v-4M16 18.5v-4M3 14.5h18',
  shop:      'M4 9.5h16V20H4zM4 9.5 6 4h12l2 5.5M9.5 20v-6h5v6',
  place:     'M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  route:     'M9 20.5 3 18V5.5l6 2.5m0 12.5 6-2.5m-6 2.5V8m6 10 6 2.5V6l-6-2.5m0 14.5V3.5',
  season:    'M4 6.5h16V20H4zM4 10.5h16M8 3.5v4M16 3.5v4M8.5 15h3',
  approve:   'M12 3 4.5 6v6c0 4.4 3.1 7.7 7.5 9 4.4-1.3 7.5-4.6 7.5-9V6z M9 12l2.2 2.2L15.5 10',
  verify:    'M12 3.2 14 5l2.6-.4.9 2.5 2.3 1.3-.9 2.5.9 2.5-2.3 1.3-.9 2.5L14 16.7l-2 1.8-2-1.8-2.6.4-.9-2.5-2.3-1.3.9-2.5-.9-2.5L6.5 7.1l.9-2.5L10 5z M9.5 11.8l1.9 1.9 3.4-3.7',
  flagShop:  'M5 21V4.5m0 0 5.5-1.2c2 -.4 3.4 .8 5.4 .4L19 3v9.5l-3.1 .7c-2 .4-3.4-.8-5.4-.4L5 14z',
  flagPost:  'M20.5 14.5a2 2 0 0 1-2 2H8l-4.5 3.5v-15a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z M12 7.5v4M12 14h.01',
  member:    'M16.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20 M9.8 11.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5 M15.6 3.8a3.6 3.6 0 0 1 0 7',
  contact:   'M3.5 6.5h17v11h-17z M3.5 7l8.5 6 8.5-6',
  partner:   'M11 6.5 8.5 9a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0l1.3-1.3 3.7 3.7a1.8 1.8 0 0 1-2.5 2.5l-.6-.6.6.6a1.8 1.8 0 0 1-2.6 2.5l-1-1 .6.6a1.8 1.8 0 0 1-2.5 2.5L3.5 16 M11 6.5h3l6.5 6.5 M3.5 16 2 14.5 6 6.5h5',
  idea:      'M9.2 17.5h5.6 M10 20.5h4 M12 3.5a5.5 5.5 0 0 0-3.2 10c.6.5.9 1.2.9 1.9h4.6c0-.7.3-1.4.9-1.9A5.5 5.5 0 0 0 12 3.5z',
  external:  'M14 4h6v6 M20 4l-8.5 8.5 M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11',
  settings:  'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M19.1 14.4a1.5 1.5 0 0 0 .3 1.6l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1.1v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.5h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.6.3h.1A1.5 1.5 0 0 0 10.6 4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.5 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.5h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9z',
  chevron:   'm9 6 6 6-6 6',
  menu:      'M4 7h16M4 12h16M4 17h16',
  close:     'M6 6l12 12M18 6 6 18',
  inbox:     'M20.5 12.5h-5l-1.5 2.5h-4L8.5 12.5h-5 M6.9 5.1 3.5 12.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-5.5l-3.4-7.4a1.5 1.5 0 0 0-1.4-.9H8.3a1.5 1.5 0 0 0-1.4.9z',
  visitor:   'M16.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20 M9.8 11.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5',
  userPlus:  'M15 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H5.6A3.6 3.6 0 0 0 2 18.2V20 M8.5 11.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z M19 8v6 M22 11h-6',
  checkin:   'M4.5 5.5h15v14h-15z M8.5 10.5l2.5 2.5 4.5-4.5',
  alert:     'M12 4 2.8 19.5h18.4z M12 10v4 M12 17h.01',
  arrowRight:'M5 12h13 M13 6.5 18.5 12 13 17.5',
  search:    'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20.5 20.5 16 16',
  edit:      'M12 20h8 M16.5 3.6a2.1 2.1 0 0 1 3 3L7.5 18.6l-4 1 1-4z',
  doc:       'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z M14 3v4.5h4.5 M8.5 12.5h7 M8.5 16.5h4.5',
  checkCircle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M8.5 12.2l2.4 2.4 4.6-4.9',
}

interface Props {
  name: AdminIconName
  size?: number
  /** 기본은 currentColor — 부모 색을 따라간다 */
  color?: string
  strokeWidth?: number
  style?: CSSProperties
  className?: string
}

export default function AdminIcon({
  name, size = 20, color = 'currentColor', strokeWidth = 1.7, style, className,
}: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
      className={className}
      aria-hidden="true" focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
