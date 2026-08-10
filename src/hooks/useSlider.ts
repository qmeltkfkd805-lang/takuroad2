'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDragScroll } from './useDragScroll'

/**
 * 가로 슬라이드 "컨테이너" 동작을 한 곳에 모은 훅.
 * (드래그 스크롤 + 세로 휠 → 가로 스크롤 + 화살표 이동 + 양끝 감지)
 *
 * 카드 디자인은 각 슬라이드가 알아서 하고, 이 훅은 컨테이너 동작만 재사용한다.
 * 최애 새소식 / 추천 루트가 함께 쓴다.
 *
 *   const s = useSlider(320)
 *   <button disabled={!s.canLeft} onClick={() => s.scrollBy(-1)} />
 *   <div {...s.railProps}>...카드...</div>
 *
 * 카드 개수가 바뀌면 s.update()를 호출해 양끝 상태를 다시 계산한다.
 */
export function useSlider(step = 300) {
  const drag = useDragScroll()
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = drag.ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = drag.ref.current
    if (!el) return
    update()
    const t = setTimeout(update, 200)   // 이미지·지도 로드 후 폭 확정되면 다시 계산
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); ro?.disconnect(); window.removeEventListener('resize', update) }
  }, [update])

  const onWheel = (e: React.WheelEvent) => {
    const el = drag.ref.current
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
  }
  const scrollBy = (dir: number) => drag.ref.current?.scrollBy({ left: dir * step, behavior: 'smooth' })

  // 스크롤 컨테이너에 그대로 펼쳐 쓴다 (드래그 + 휠 + 스크롤 감지)
  const railProps = { ...drag, onWheel, onScroll: update }

  return { railProps, scrollBy, canLeft, canRight, update, ref: drag.ref }
}
