'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 가로 슬라이드 "컨테이너" 동작을 한 곳에 모은 훅.
 * (세로 휠 → 가로 스크롤 + 좌우 화살표 이동 + 양끝 감지)
 *
 * 예전에는 마우스로 끌어서 넘기는 드래그 스크롤도 들어 있었는데,
 * 홈에서는 "마우스를 올리면 뜨는 < > 버튼"으로 넘기기로 바꿔서 뺐다.
 * 터치(모바일)·트랙패드 가로 스크롤은 브라우저 기본 동작 그대로 된다.
 *
 *   const s = useSlider(320)
 *   <button disabled={!s.canLeft} onClick={() => s.scrollBy(-1)} />
 *   <div {...s.railProps}>...카드...</div>
 *
 * 카드 개수가 바뀌면 s.update()를 호출해 양끝 상태를 다시 계산한다.
 */
export function useSlider(step = 300) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const t = setTimeout(update, 200)   // 이미지 로드 후 폭 확정되면 다시 계산
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); ro?.disconnect(); window.removeEventListener('resize', update) }
  }, [update])

  const onWheel = (e: React.WheelEvent) => {
    const el = ref.current
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
  }
  /* 화살표 한 번 = 보이는 폭의 85%쯤(최소 step). 다음 카드가 살짝 걸쳐 보여 이어짐을 알 수 있다. */
  const scrollBy = (dir: number) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(step, Math.round(el.clientWidth * 0.85)), behavior: 'smooth' })
  }

  // 스크롤 컨테이너에 그대로 펼쳐 쓴다 (휠 + 스크롤 감지)
  const railProps = { ref, onWheel, onScroll: update }

  return { railProps, scrollBy, canLeft, canRight, update, ref }
}
