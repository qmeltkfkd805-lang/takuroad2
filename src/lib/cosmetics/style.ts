import { CSSProperties } from 'react'

/* 코스메틱을 실제로 "보이게" 만드는 곳.

   ⭐ 이미지 자산이 아직 없다. 가짜 이미지를 넣느니 진짜 CSS로 그린다.
      나중에 cosmetics.asset_url이 채워지면 그게 우선한다.
   ⭐ 여기가 slug → 스타일의 유일한 매핑이다. 새 코스메틱이 생기면 여기에만 추가. */

/** 프로필 프레임 — 아바타를 감싸는 테두리 */
export const FRAME_STYLE: Record<string, CSSProperties> = {
  'frame-review':  { border: '3px solid #FF5692', boxShadow: '0 0 0 3px #FFE3EE' },
  'frame-event':   { border: '3px solid #7C5CFF', boxShadow: '0 0 0 3px #EFEAFF' },
  'frame-pilgrim': { border: '3px solid #12B886', boxShadow: '0 0 0 3px #E3F8F1' },
  'frame-route':   { border: '3px solid #3D7FE0', boxShadow: '0 0 0 3px #E6F0FF' },
  'frame-gold': {
    border: '3px solid transparent',
    backgroundImage: 'linear-gradient(#fff,#fff), linear-gradient(135deg,#FFD75E,#D9930F,#FFE9A8)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'content-box, border-box',
    boxShadow: '0 0 14px rgba(217,147,15,.45)',
  },
  'frame-neon': {
    border: '3px solid #FF3DCB',
    boxShadow: '0 0 8px #FF3DCB, 0 0 18px rgba(255,61,203,.6), inset 0 0 8px rgba(255,61,203,.35)',
  },
  'frame-sakura': {
    border: '3px solid transparent',
    backgroundImage: 'linear-gradient(#fff,#fff), linear-gradient(135deg,#FFC7DC,#FF8FB3,#FFE3EE,#FFC7DC)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'content-box, border-box',
    boxShadow: '0 0 16px rgba(255,143,179,.55)',
  },
}

/** 프로필 배경 */
/** 프로필 배경 — 색과 분위기만.
    ⭐ 별·벚꽃·반짝임 같은 '움직이는 것'은 효과(effect)의 몫이다.
       배경에 점을 넣으면 효과와 겹쳐 역할이 흐려진다. 배경은 깔끔한 그라디언트로. */
export const BG_STYLE: Record<string, CSSProperties> = {
  'bg-sakura': { background: 'linear-gradient(160deg,#FFE9F1 0%,#FFF4F7 48%,#FFF8EC 100%)' },
  'bg-night':  { background: 'linear-gradient(180deg,#1E2A4E 0%,#3E4C7E 30%,#7C6E9C 55%,#C98BA0 78%,#F5C79B 100%)', color: '#fff' },
  'bg-star':   { background: 'linear-gradient(180deg,#141A33 0%,#2A3358 45%,#4A4F86 100%)', color: '#fff' },
  'bg-city':   { background: 'linear-gradient(180deg,#2B1B44 0%,#6B3B6E 58%,#E08BA0 100%)', color: '#fff' },
  'bg-shelf':  { background: 'linear-gradient(160deg,#E8D3B6 0%,#C7996B 55%,#A87A50 100%)' },
  'bg-cafe':   { background: 'linear-gradient(160deg,#F4E7D6 0%,#D9B892 60%,#B08C63 100%)' },
  'bg-film':   { background: 'linear-gradient(180deg,#2A2732 0%,#4A4438 45%,#1C1B22 100%)', color: '#fff' },
  'bg-coral':  { background: 'linear-gradient(160deg,#FF8FB3 0%,#FFB877 55%,#FFE3A3 100%)' },

  /* 일반 등급 — 색깔만. 이미지가 있는 건 레어 이상이다. */
  'bg-cream':    { background: 'linear-gradient(160deg,#FFF9EC,#FBF6EE)' },
  'bg-sky':      { background: 'linear-gradient(160deg,#E3F1FF,#F2F8FF)' },
  'bg-mint':     { background: 'linear-gradient(160deg,#E1F7F2,#F1FBF9)' },
  'bg-lavender': { background: 'linear-gradient(160deg,#F0ECFF,#F8F6FF)' },
  'bg-peach':    { background: 'linear-gradient(160deg,#FFE9E0,#FFF6F1)' },
  'bg-ink':      { background: 'linear-gradient(160deg,#2A2A33,#4A4A57)', color: '#fff' },
}

/** 프로필 효과 — 애니메이션. globals.css에 keyframes가 있어야 한다 */
export const FX_CLASS: Record<string, string> = {
  'fx-sparkle': 'fxSparkle',
  'fx-sakura':  'fxSakura',
  'fx-star':    'fxStar',
  'fx-aura':    'fxAura',
  'fx-neon':    'fxNeon',
}

/** 프로필 테마 — 전체 분위기 (카드 배경 + 강조색) */
export const THEME_STYLE: Record<string, CSSProperties> = {
  'theme-pink': { ['--c-accent' as any]: '#FF5692', background: 'linear-gradient(135deg,#FFF0F5,#FFF9EC)' },
  'theme-blue': { ['--c-accent' as any]: '#3D7FE0', background: 'linear-gradient(135deg,#EAF2FF,#F3F8FF)' },
  'theme-neon': { ['--c-accent' as any]: '#FF3DCB', background: 'linear-gradient(135deg,#1B1030,#3A1652)', color: '#fff' },
}

/** 미리보기용 — 목록에서 이게 뭔지 보여준다 */
export function previewStyle(type: string, slug: string): CSSProperties {
  if (type === 'frame')      return { ...FRAME_STYLE[slug], background: '#fff' }
  if (type === 'background') return BG_STYLE[slug] ?? {}
  if (type === 'theme')      return THEME_STYLE[slug] ?? {}
  return {}
}

export const RARITY_LABEL: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
}

/* ────────────────────────────────────────────────
   이미지가 있으면 CSS보다 이게 우선한다.

   ⭐ 설계할 때 한 약속이다 — "가짜 이미지를 넣느니 진짜 CSS가 낫다.
      나중에 asset_url이 채워지면 그게 우선한다."
      이제 이미지가 생겼으니 약속을 지킨다.
   ──────────────────────────────────────────────── */

/** 배경 — 이미지가 있으면 이미지, 없으면 CSS 그라디언트 */
export function bgStyle(slug?: string, assetUrl?: string | null): CSSProperties {
  if (assetUrl) {
    return {
      backgroundImage: 'url(' + assetUrl + ')',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      color: '#fff',
    }
  }
  return slug ? (BG_STYLE[slug] ?? {}) : {}
}

/** 테마 — 배경 이미지가 있으면 테마 배경은 양보한다(겹치면 안 보임) */
export function themeStyle(slug?: string, hasBgImage = false): CSSProperties {
  if (!slug) return {}
  const s = THEME_STYLE[slug] ?? {}
  if (!hasBgImage) return s
  const { background, ...rest } = s as any   // 강조색만 남긴다
  return rest
}

/* 효과 클래스 — globals.css의 전역 클래스를 가리킨다.
   ⭐ CSS 모듈로 쪼개면 네 화면에 같은 CSS를 복사하게 되고 결국 서로 달라진다.
      효과는 앱 어디서든 같은 모습이어야 하니 한 곳에서만 정의한다. */
const FX_GLOBAL: Record<string, string> = {
  'fx-sparkle': 'tkfx-sparkle',
  'fx-sakura':  'tkfx-sakura',
  'fx-star':    'tkfx-star',
  'fx-aura':    'tkfx-aura',
  'fx-neon':    'tkfx-neon',
  'fx-holo':    'tkfx-holo',
  'fx-grain':   'tkfx-grain',
}

/** 효과를 입힐 때 쓴다 — 베이스(.tkfx) + 종류 */
export function fxClass(slug?: string): string {
  if (!slug) return ''
  const c = FX_GLOBAL[slug]
  return c ? 'tkfx ' + c : ''
}
