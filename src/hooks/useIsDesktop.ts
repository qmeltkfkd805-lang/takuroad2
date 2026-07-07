'use client'

/**
 * 항상 데스크톱(신규) 레이아웃을 사용한다.
 * 화면이 좁아져도 예전 모바일 컴포넌트로 되돌아가지 않게 하기 위함.
 * (좁은 화면 대응은 각 페이지의 2컬럼 그리드가 반응형으로 세로로 쌓이는 것으로 처리)
 */
export function useIsDesktop() {
  return true
}
