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
export const BG_STYLE: Record<string, CSSProperties> = {
  'bg-sakura': { background: 'linear-gradient(135deg,#FFE3EE 0%,#FFF3F7 55%,#FFF9EC 100%)' },
  'bg-night':  { background: 'linear-gradient(160deg,#1B2140 0%,#39406B 70%,#5A5F8F 100%)', color: '#fff' },
  'bg-star':   { background: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1.5px, transparent 1.5px), linear-gradient(160deg,#232A52,#4A4F86)', backgroundSize: '90px 90px, 130px 130px, cover', color: '#fff' },
  'bg-city':   { background: 'linear-gradient(180deg,#2B1B44 0%,#6B3B6E 60%,#E08BA0 100%)', color: '#fff' },
  'bg-shelf':  { background: 'repeating-linear-gradient(90deg,#C7996B 0 12px,#A87A50 12px 15px,#DCB98C 15px 26px,#B98A5E 26px 30px)' },
  'bg-cafe':   { background: 'linear-gradient(135deg,#F2E3D0,#D9B892 70%,#B08C63)' },
  'bg-film':   { background: 'repeating-linear-gradient(0deg,#1C1C22 0 14px,#2A2A33 14px 18px)', color: '#fff' },
  'bg-coral':  { background: 'linear-gradient(135deg,#FF8FB3,#FFB877,#FFE3A3)' },
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
