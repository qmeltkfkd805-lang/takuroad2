/* ============================================================
   덕질 지역 (Geek Area)
   
   사용자는 "마포구 갔다"가 아니라 "홍대 갔다"고 기억한다.
   행정구역이 아니라 덕후들이 실제로 인식하는 지역 단위.
   
   전국 행정구역을 다 만들 필요 없다 — 덕질이 활발한 곳만 관리.
   매칭이 안 되면 행정구역(구/시)으로 폴백하므로 없어도 안 깨진다.
   ============================================================ */

interface GeekAreaRule {
  area: string
  // 주소에 이 중 하나라도 들어 있으면 해당 덕질 지역
  keywords: string[]
}

/** 덕질 지역 매핑 — 활발한 곳부터 추가해 나간다 */
const GEEK_AREAS: GeekAreaRule[] = [
  // 서울
  { area: '홍대',   keywords: ['서교동', '동교동', '양화로', '와우산로', '홍익로', '어울마당로'] },
  { area: '성수',   keywords: ['성수동', '연무장길', '아차산로', '뚝섬로'] },
  { area: '강남',   keywords: ['역삼동', '강남대로', '테헤란로', '삼성동', '논현동'] },
  { area: '건대',   keywords: ['화양동', '능동로', '아차산로1'] },
  { area: '명동',   keywords: ['명동', '을지로', '충무로'] },
  { area: '이태원', keywords: ['이태원', '한남동', '경리단길'] },
  { area: '신촌',   keywords: ['신촌', '창천동', '연세로'] },
  { area: '용산',   keywords: ['용산구 한강대로', '아이파크몰'] },
  { area: '잠실',   keywords: ['잠실', '올림픽로'] },
  { area: '영등포', keywords: ['영등포', '타임스퀘어'] },

  // 경기
  { area: '수원',   keywords: ['수원시'] },
  { area: '분당',   keywords: ['분당구', '판교'] },
  { area: '일산',   keywords: ['일산동구', '일산서구'] },
  { area: '부천',   keywords: ['부천시'] },

  // 부산
  { area: '서면',   keywords: ['부산진구', '서면'] },
  { area: '해운대', keywords: ['해운대'] },

  // 기타 광역
  { area: '대구',   keywords: ['대구광역시', '대구 '] },
  { area: '대전',   keywords: ['대전광역시', '대전 '] },
  { area: '광주',   keywords: ['광주광역시'] },
]

/** 주소에서 시/도 추출 (폴백용) */
function cityFromAddr(addr: string): string | null {
  const m = addr.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/)
  return m ? m[1] : null
}

/** 주소에서 구/시 추출 (폴백용) */
function districtFromAddr(addr: string): string | null {
  // "수원시 장안구" → 수원시 우선
  const si = addr.match(/([가-힣]+시)\s/)
  if (si) return si[1]
  const gu = addr.match(/([가-힣]+구)\s/)
  if (gu) return gu[1]
  const gun = addr.match(/([가-힣]+군)\s/)
  if (gun) return gun[1]
  return null
}

/**
 * 주소 → 덕질 지역.
 * 매핑에 있으면 덕질 지역명("홍대"), 없으면 행정구역으로 폴백("마포구"),
 * 그것도 없으면 시/도("서울"), 최후엔 null.
 */
export function geekAreaFromAddr(addr: string | null | undefined): string | null {
  if (!addr) return null
  const a = addr.replace(/\s+/g, ' ').trim()

  for (const rule of GEEK_AREAS) {
    if (rule.keywords.some(k => a.includes(k))) return rule.area
  }

  // 폴백 — 매핑에 없는 지역도 Story가 만들어져야 한다
  return districtFromAddr(a) ?? cityFromAddr(a)
}

/** Shop 객체에서 덕질 지역 (addr 기반) */
export function shopGeekArea(shop: { addr?: string | null }): string | null {
  return geekAreaFromAddr(shop.addr)
}
