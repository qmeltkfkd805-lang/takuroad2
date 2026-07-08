'use client'
import { useRef } from 'react'

/**
 * 마우스로 가로 줄을 밀어서 스크롤한다. (MapBottomSheet의 드래그 로직을 훅으로 뺀 것)
 *
 * 드래그로 민 직후의 click은 삼킨다 — 안 그러면 카드를 밀기만 했는데
 * 상세 페이지로 넘어가버린다.
 *
 *   const drag = useDragScroll()
 *   <div {...drag}>...</div>
 */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()   // 이미지·텍스트 드래그 선택 방지
    state.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || !state.current.down) return
    const dx = e.pageX - state.current.startX
    if (Math.abs(dx) > 4) state.current.moved = true   // 4px 미만은 클릭으로 본다
    el.scrollLeft = state.current.startScroll - dx
  }

  const end = () => { state.current.down = false }

  const onClickCapture = (e: React.MouseEvent) => {
    if (state.current.moved) { e.preventDefault(); e.stopPropagation() }
  }

  return {
    ref,
    onMouseDown,
    onMouseMove,
    onMouseUp: end,
    onMouseLeave: end,
    onClickCapture,
  }
}
