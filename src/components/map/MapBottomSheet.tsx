'use client'

import { useState, useRef, useEffect } from 'react'
import { Shop } from '@/types/shop'
import { useSaved } from '@/hooks/useSaved'
import { useAuth } from '@/components/layout/AuthProvider'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { ShopCard } from '@/components/tds'
import ShopRow from '@/components/shop/ShopCard'
import styles from './MapBottomSheet.module.css'

type SheetState = 'closed' | 'peek' | 'expanded'
const ORDER: SheetState[] = ['closed', 'peek', 'expanded']

interface MapBottomSheetProps {
  shops: Shop[]
  onSelectShop: (shop: Shop) => void
  onStateChange?: (state: SheetState) => void
}

export default function MapBottomSheet({ shops, onSelectShop, onStateChange }: MapBottomSheetProps) {
  const { isSaved, toggleSave } = useSaved()
  const { user } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<SheetState>('peek')
  useEffect(() => { onStateChange?.(state) }, [state, onStateChange])
  const startY = useRef<number | null>(null)
  const movedRef = useRef(0)

  // 가로 카드 영역 마우스 드래그 스크롤
  const rowRef = useRef<HTMLDivElement>(null)
  const hDrag = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const step = (dir: 1 | -1) => {
    setState(prev => {
      const i = ORDER.indexOf(prev)
      const next = Math.min(ORDER.length - 1, Math.max(0, i + dir))
      return ORDER[next]
    })
  }

  // 시트 위아래 터치 드래그
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    movedRef.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    movedRef.current = e.touches[0].clientY - startY.current
  }
  const onTouchEnd = () => {
    const dy = movedRef.current
    const THRESHOLD = 40
    if (dy < -THRESHOLD) step(1)
    else if (dy > THRESHOLD) step(-1)
    startY.current = null
    movedRef.current = 0
  }

  // 가로 카드 마우스 드래그
  const onRowMouseDown = (e: React.MouseEvent) => {
    const el = rowRef.current
    if (!el) return
    e.preventDefault()
    hDrag.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false }
  }
  const onRowMouseMove = (e: React.MouseEvent) => {
    const el = rowRef.current
    if (!el || !hDrag.current.down) return
    const dx = e.pageX - hDrag.current.startX
    if (Math.abs(dx) > 4) hDrag.current.moved = true
    el.scrollLeft = hDrag.current.startScroll - dx
  }
  const endRowDrag = () => { hDrag.current.down = false }
  const onRowClickCapture = (e: React.MouseEvent) => {
    if (hDrag.current.moved) { e.preventDefault(); e.stopPropagation() }
  }

  // 닫힘: 작은 핸들만
  if (state === 'closed') {
    return (
      <button
        className={styles.reopen}
        onClick={() => setState('peek')}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="목록 열기"
      >
        <span className={styles.reopenHandle} />
      </button>
    )
  }

  const expanded = state === 'expanded'

  return (
    <div className={expanded ? styles.sheetExpanded : styles.sheet}>
      <div
        className={styles.dragZone}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.handle} onClick={() => step(-1)} />
        <div className={styles.header}>
          <div className={styles.title}>
            주변 샵 <strong>{shops.length}</strong>개
          </div>
          <button
            className={styles.listBtn}
            onClick={() => setState(expanded ? 'peek' : 'expanded')}
          >
            {expanded ? '접기' : '목록 보기'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className={styles.list}>
          {shops.map(shop => (
            <ShopRow key={shop.id} shop={shop} isActive={false} onClick={onSelectShop} />
          ))}
        </div>
      ) : (
        <div
          ref={rowRef}
          className={styles.row}
          onMouseDown={onRowMouseDown}
          onMouseMove={onRowMouseMove}
          onMouseUp={endRowDrag}
          onMouseLeave={endRowDrag}
          onClickCapture={onRowClickCapture}
        >
          {shops.map(shop => (
            <div key={shop.id} className={styles.cardWrap}>
              <ShopCard shop={{ ...shop, isSaved: isSaved(shop.id) } as Shop} meta="distance" onClick={onSelectShop} onToggleSave={(sh) => { if (!user) { router.push(ROUTES.login); return } toggleSave(sh.id) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
