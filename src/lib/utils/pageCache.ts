/* 화면 결과 잠깐 기억 (2026-10-15)
   한 번 본 화면은 다시 열 때 지난 결과를 바로 보여주고, 뒤에서 최신으로 바꾼다 → '불러오는 중'이 안 뜬다.
   브라우저 탭 안(메모리)에서만 유지 — 새로고침하면 비워진다. 서버에선 쓰지 않는다(첫 화면 그리기와 어긋나지 않게). */
const store = new Map<string, unknown>()

export function peekCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  return store.get(key) as T | undefined
}

export function putCache<T>(key: string, value: T): T {
  if (typeof window !== 'undefined') store.set(key, value)
  return value
}
