/* 유입 경로(첫 방문) 기록 — "이 사람이 어디서 들어왔는지"를 가입 시점에 profiles에 남기기 위한 것.
   - 앱을 처음 연 순간 딱 한 번만 localStorage에 저장한다(그 뒤 방문에서는 덮어쓰지 않음 = first-touch).
   - 로그인 페이지·OAuth 콜백을 거치면 document.referrer가 우리 사이트로 바뀌므로,
     반드시 랜딩 시점에 잡아둬야 한다.
   - 개인정보가 아니라 유입 채널 판별용이며, referrer는 우리 도메인이면 저장하지 않는다. */

const KEY = 'taku_first_touch'

export interface FirstTouch {
  referrer: string | null      // 바깥에서 들어온 경우의 원본 referrer
  landingPath: string | null   // 처음 도착한 페이지 경로
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  at: string                   // 기록 시각(ISO)
}

/** referrer 호스트 → 사람이 읽는 채널 이름 */
export function channelOf(t: Pick<FirstTouch, 'referrer' | 'utmSource'> | null): string {
  if (!t) return '알 수 없음'
  if (t.utmSource) return t.utmSource
  if (!t.referrer) return '직접 유입'
  let host = ''
  try { host = new URL(t.referrer).hostname.replace(/^www\./, '').toLowerCase() } catch { return '알 수 없음' }
  const map: [string, string][] = [
    ['naver.', '네이버'], ['search.naver', '네이버'], ['blog.naver', '네이버 블로그'], ['cafe.naver', '네이버 카페'],
    ['google.', '구글'], ['daum.', '다음'], ['bing.', '빙'],
    ['instagram.', '인스타그램'], ['threads.', '스레드'],
    ['twitter.', 'X(트위터)'], ['x.com', 'X(트위터)'], ['t.co', 'X(트위터)'],
    ['youtube.', '유튜브'], ['youtu.be', '유튜브'],
    ['tistory.', '티스토리'], ['blogspot.', '블로그스팟'], ['brunch.', '브런치'],
    ['kakao.', '카카오'], ['open.kakao', '오픈채팅'],
    ['dcinside.', '디시인사이드'], ['arca.live', '아카라이브'], ['ruliweb.', '루리웹'], ['fmkorea.', '에펨코리아'],
    ['facebook.', '페이스북'], ['reddit.', '레딧'],
  ]
  for (const [k, label] of map) if (host.includes(k)) return label
  return host || '알 수 없음'
}

/** 앱 첫 로드 때 호출. 이미 기록돼 있으면 아무것도 하지 않는다. */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(KEY)) return

    const ref = document.referrer || ''
    let external: string | null = null
    if (ref) {
      try { external = new URL(ref).hostname === location.hostname ? null : ref } catch { external = null }
    }

    const q = new URLSearchParams(location.search)
    const touch: FirstTouch = {
      referrer: external,
      landingPath: location.pathname + (location.search || ''),
      utmSource: q.get('utm_source') || q.get('ref'),
      utmMedium: q.get('utm_medium'),
      utmCampaign: q.get('utm_campaign'),
      at: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(touch))
  } catch { /* 사파리 프라이빗 모드 등 — 유실돼도 서비스에 지장 없음 */ }
}

export function readFirstTouch(): FirstTouch | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FirstTouch) : null
  } catch { return null }
}
