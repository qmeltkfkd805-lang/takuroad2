'use client'
import { CSSProperties, ReactNode } from 'react'

/**
 * 앱 전역 아이콘.
 * - public/icons 에 PNG가 있는 이름은 마스크로 그려서 color 를 그대로 입힌다.
 * - 없는 것은 아래 SVG 레지스트리에서 그린다.
 * 이모지를 직접 쓰지 말고 이 컴포넌트를 쓴다.
 */

const PNG_ICONS = new Set([
  'shop', 'event', 'goods', 'book', 'tcg', 'secondhand', 'cafe', 'popup', 'game', 'onlineshop',
  'box', 'calendar', 'clock', 'photo', 'news', 'bell', 'heart', 'star', 'gift', 'fire',
  'coin', 'receipt', 'people', 'search', 'map', 'route', 'work', 'collection', 'activity',
  'price', 'parcel', 'staff', 'service', 'wifi', 'parking', 'restroom', 'elevator',
  'exchange', 'exhibition', 'gacha', 'premium', 'new', 'checkin', 'card', 'cash', 'lv',
  'homepage', 'kakao', 'instargram',
])

const S = { fill: 'none', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const SVG_ICONS: Record<string, ReactNode> = {
  pin: <><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></>,
  pushpin: <><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3z" /><path d="M12 14v7" /></>,
  sparkle: <><path d="M12 3.5 13.8 9 19 10.8 13.8 12.6 12 18 10.2 12.6 5 10.8 10.2 9z" /><path d="M18.5 4.5v3M17 6h3" /></>,
  comment: <path d="M20.5 11.5a7.9 7.9 0 0 1-8.5 7.9 8.4 8.4 0 0 1-3.2-.6L4 20.5l1.7-4.8A7.9 7.9 0 0 1 12 3.6a7.9 7.9 0 0 1 8.5 7.9z" />,
  clip: <path d="M20.5 12.5 12.5 20.5a4.7 4.7 0 0 1-6.6-6.6l8-8a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.6 1.6 0 0 1-2.2-2.2l7.4-7.4" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 14.6a5.5 5.5 0 0 1 3 5.4" /></>,
  user: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  chart: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 17v-5M12.5 17V8M17 17v-7" /></>,
  handshake: <path d="m8 12 2.4 2.4a1.6 1.6 0 0 0 2.3 0l.6-.6 2.3 2.3M3 10l4-4 3 1.5L13 6l4 1.5 4-1.5v7l-3 3-4-3.5" />,
  tent: <><path d="m12 4 8 16H4z" /><path d="M12 4v16" /></>,
  books: <><rect x="4" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="16" rx="1" /><path d="m16.5 5.5 3.6 1-3 14.5-3.6-1z" /></>,
  image: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4.5 17 4.5-4.5 3 3L16 11l4 4.5" /></>,
  film: <><rect x="2.5" y="6" width="14" height="12" rx="2" /><path d="m16.5 10 5-2.5v9l-5-2.5" /></>,
  tag: <><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.1" /></>,
  note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8.5 13h7M8.5 16.5h5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M18 9.5a4 4 0 0 1 0 5" /></>,
  camera: <><rect x="3" y="7" width="18" height="13" rx="2.4" /><circle cx="12" cy="13.5" r="3.6" /><path d="M8.5 7 10 4.5h4L15.5 7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.5 12h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2z" /></>,
  coffee: <><path d="M4 8h12v6.5a4.5 4.5 0 0 1-9 0z" /><path d="M16 9.5h2.2a2.3 2.3 0 0 1 0 4.6H16" /><path d="M6 3.5v2M10 3v2.5M14 3.5v2" /></>,
  shield: <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M4.5 7.5l2.2 1.3M17.3 15.2l2.2 1.3M4.5 16.5l2.2-1.3M17.3 8.8l2.2-1.3" /></>,
  bookmark: <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z" />,
  pencil: <><path d="m4 20 .9-3.7L16.4 4.8a2 2 0 0 1 2.8 2.8L7.7 19.1z" /><path d="m14.5 6.7 2.8 2.8" /></>,
  eye: <><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  road: <><path d="M8 3 5 21M16 3l3 18" /><path d="M12 4v3M12 10.5v3M12 17v3" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 4.5h11l-2 3.5 2 3.5H6z" /></>,
  crown: <path d="m4 17 1-9 4.5 3.5L12 5l2.5 6.5L19 8l1 9z" />,
  medal: <><circle cx="12" cy="14.5" r="5" /><path d="M8.5 9.5 6 3h12l-2.5 6.5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 5.5H5.5v1.5a3 3 0 0 0 3 3M16 5.5h2.5V7a3 3 0 0 1-3 3" /><path d="M12 13v3.5M9 20h6" /></>,
  check: <path d="m5 12 5 5 9-10" strokeWidth={2.6} />,
  close: <path d="M18 6 6 18M6 6l12 12" strokeWidth={2.2} />,
  warning: <><path d="M12 4 2.8 20h18.4z" /><path d="M12 10v4M12 17.2v.1" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.8.7-.8 1.3v.5M12 16.8v.1" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" /><path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.5" /></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3 7 8.2 5.6a1.4 1.4 0 0 0 1.6 0L21 7" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></>,
  building: <><rect x="4.5" y="3.5" width="15" height="17" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20.5v-4h3v4" /></>,
  car: <><path d="M4 15.5V12l2-4.5h12L20 12v3.5" /><path d="M3.5 15.5h17v3h-3v-3M7 18.5v-3" /><circle cx="7.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" /><circle cx="16.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" /></>,
  walk: <><circle cx="13" cy="4.6" r="1.8" /><path d="m11 21 1.5-5.5-2-2 1-4.5 3 2 2.5 1M9.5 13.5 8 21" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" /></>,
  ticket: <><path d="M3.5 8.5V6.5h17v2a2.5 2.5 0 0 0 0 5v2h-17v-2a2.5 2.5 0 0 0 0-5z" /><path d="M12 7v2M12 12v2M12 17v-2" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1.2-1.6-1.2-2.7 0-.8.7-1.5 1.6-1.5h1.8a4.3 4.3 0 0 0 4.3-4.3C20.5 6.4 16.7 3.5 12 3.5z" /><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.8" cy="9.6" r="1.1" fill="currentColor" stroke="none" /></>,
  hourglass: <><path d="M7 3.5h10M7 20.5h10" /><path d="M7.5 3.5v3.2L12 12l-4.5 5.3v3.2M16.5 3.5v3.2L12 12l4.5 5.3v3.2" /></>,
}

interface Props {
  name: string
  size?: number
  color?: string
  style?: CSSProperties
  label?: string
}

export default function AppIcon({ name, size = 18, color = 'currentColor', style, label }: Props) {
  if (PNG_ICONS.has(name)) {
    return (
      <span
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{
          width: size, height: size, display: 'inline-block', flexShrink: 0,
          backgroundColor: color,
          WebkitMaskImage: 'url(/icons/' + name + '.png)', maskImage: 'url(/icons/' + name + '.png)',
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain', maskSize: 'contain',
          WebkitMaskPosition: 'center', maskPosition: 'center',
          verticalAlign: '-2px',
          ...style,
        }}
      />
    )
  }

  const path = SVG_ICONS[name] ?? SVG_ICONS.question
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      stroke={color} {...S}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flexShrink: 0, verticalAlign: '-2px', ...style }}
    >
      {label && <title>{label}</title>}
      {path}
    </svg>
  )
}