// 작품 유형(분류) 표준 목록 — 등록 폼과 필터가 같은 값을 쓴다.
export const IP_TYPES = ['웹툰', '웹소설', '애니', '만화', '버튜버', '캐릭터', '게임', '보컬로이드'] as const
export type IpType = (typeof IP_TYPES)[number]

// 기존에 제각각 저장된 값(anime / 애니메이션 / 버추얼 등)을 표준 라벨로 정리한다.
const ALIAS: Record<string, string> = {
  anime: '애니', 애니메이션: '애니', 애니메: '애니', animation: '애니',
  game: '게임', 게임: '게임',
  vtuber: '버튜버', 버추얼: '버튜버', 'v-tuber': '버튜버', vtubers: '버튜버',
  character: '캐릭터', character_brand: '캐릭터', 캐릭터브랜드: '캐릭터',
  webtoon: '웹툰',
  webnovel: '웹소설', 'web-novel': '웹소설',
  manga: '만화', comic: '만화', comics: '만화',
  vocaloid: '보컬로이드',
}

/** 원본 ip_type 값을 표준 라벨로 변환. 못 맞추면 원본을 그대로 돌려준다. */
export function normIpType(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if ((IP_TYPES as readonly string[]).includes(s)) return s
  return ALIAS[s.toLowerCase()] ?? ALIAS[s] ?? s
}

/** ip_type은 복수 저장 가능(콤마 구분). 표준화한 유형 목록으로 분리한다. */
export function ipTypeList(raw?: string | null): string[] {
  if (!raw) return []
  return [...new Set(String(raw).split(',').map(s => normIpType(s)).filter((x): x is string => !!x))]
}

