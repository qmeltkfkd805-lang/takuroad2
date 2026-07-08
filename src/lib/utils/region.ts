import { Shop } from '@/types/shop'

// 시/도 표준 표기 (드롭다운 정렬 순서이기도 함)
export const SIDO = [
  '서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종',
  '전북', '전남', '광주', '경북', '경남', '대구', '울산', '부산', '제주',
] as const

// 주소 첫 토큰에서 나올 수 있는 표기들 → 표준 표기
const ALIASES: Record<string, string> = {
  '서울': '서울', '서울시': '서울', '서울특별시': '서울',
  '경기': '경기', '경기도': '경기',
  '인천': '인천', '인천시': '인천', '인천광역시': '인천',
  '강원': '강원', '강원도': '강원', '강원특별자치도': '강원',
  '충북': '충북', '충청북도': '충북',
  '충남': '충남', '충청남도': '충남',
  '대전': '대전', '대전시': '대전', '대전광역시': '대전',
  '세종': '세종', '세종시': '세종', '세종특별자치시': '세종',
  '전북': '전북', '전라북도': '전북', '전북특별자치도': '전북',
  '전남': '전남', '전라남도': '전남',
  '광주': '광주', '광주시': '광주', '광주광역시': '광주',
  '경북': '경북', '경상북도': '경북',
  '경남': '경남', '경상남도': '경남',
  '대구': '대구', '대구시': '대구', '대구광역시': '대구',
  '울산': '울산', '울산시': '울산', '울산광역시': '울산',
  '부산': '부산', '부산시': '부산', '부산광역시': '부산',
  '제주': '제주', '제주도': '제주', '제주시': '제주', '제주특별자치도': '제주',
}

/** 주소 문자열에서 시/도를 추출 (예: "서울특별시 마포구 …" → "서울") */
export function regionFromAddr(addr: string | null | undefined): string | null {
  if (!addr) return null
  const head = addr.trim().split(/\s+/)[0]
  if (!head) return null
  if (ALIASES[head]) return ALIASES[head]
  // "서울마포구"처럼 붙여 쓴 경우 대비 — 앞부분 매칭
  for (const key of Object.keys(ALIASES)) {
    if (head.startsWith(key)) return ALIASES[key]
  }
  return null
}

/**
 * 주소에서 구/군(시 아래 구 포함)을 추출
 * "서울특별시 마포구 …"    → "마포구"
 * "경기도 성남시 분당구 …" → "성남시 분당구"
 * "경기도 가평군 …"        → "가평군"
 */
export function districtFromAddr(addr: string | null | undefined): string | null {
  if (!addr || !regionFromAddr(addr)) return null
  const parts = addr.trim().split(/\s+/)
  const t1 = parts[1]
  const t2 = parts[2]
  if (!t1 || !/(시|군|구)$/.test(t1)) return null
  if (t2 && /구$/.test(t2) && /시$/.test(t1)) return `${t1} ${t2}`
  return t1
}

/** 샵의 시/도: DB region 우선, 없으면 주소에서 추출 */
export function shopRegion(shop: Pick<Shop, 'region' | 'addr'>): string | null {
  const fromDb = shop.region?.trim()
  if (fromDb) return ALIASES[fromDb] ?? fromDb
  return regionFromAddr(shop.addr)
}

/** 샵의 구/군: DB district·city 우선, 없으면 주소에서 추출 */
export function shopDistrict(
  shop: Pick<Shop, 'region' | 'addr' | 'city' | 'district'>,
): string | null {
  const city = shop.city?.trim()
  const dist = shop.district?.trim()
  if (city && dist && /시$/.test(city) && /구$/.test(dist)) return `${city} ${dist}`
  if (dist) return dist
  if (city) return city
  return districtFromAddr(shop.addr)
}

/** 시/도 표준 순서로 정렬 (표준에 없는 값은 뒤에 가나다순) */
export function sortRegions(list: string[]): string[] {
  const order = new Map<string, number>(SIDO.map((s, i) => [s, i]))
  return [...list].sort((a, b) => {
    const ia = order.get(a) ?? 999
    const ib = order.get(b) ?? 999
    if (ia !== ib) return ia - ib
    return a.localeCompare(b, 'ko')
  })
}
