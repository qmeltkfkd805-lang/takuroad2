'use client'

import { useState, useRef } from 'react'
import { Shop } from '@/types/shop'
import { ShopCard } from '@/components/tds'
import ShopRow from '@/components/shop/ShopCard'
import styles from './MapBottomSheet.module.css'

type SheetState = 'closed' | 'peek' | 'expanded'
const ORDER: SheetState[] = ['closed', 'peek', 'expanded']

interface MapBottomSheetProps {
  shops: Shop[]
  onSelectShop: (shop: Shop) => void
}

export default function MapBottomSheet({ shops, onSelectShop }: MapBottomSheetProps) {
  const [state, setState] = useState<SheetState>('peek')
  const startY = useRef<number | null>(null)
  const movedRef = useRef(0)

  const step = (dir: 1 | -1) => {
    setState(prev => {
      const i = ORDER.indexOf(prev)
      const next = Math.min(ORDER.length - 1, Math.max(0, i + dir))
      return ORDER[next]
    })
  }

  // 드래그 시작/이동/끝 — 위로 올리면 한 단계 위, 내리면 한 단계 아래
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
    const THRESHOLD = 40 // 이 이상 움직여야 단계 전환
    if (dy < -THRESHOLD) step(1)       // 위로 드래그 → 펼침 쪽
    else if (dy > THRESHOLD) step(-1)  // 아래로 드래그 → 접힘 쪽
    startY.current = null
    movedRef.current = 0
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
      {/* 핸들+헤더를 잡고 드래그 / 핸들 클릭은 한 단계 내림 */}
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
        <div className={styles.row}>
          {shops.map(shop => (
            <div key={shop.id} className={styles.cardWrap}>
              <ShopCard shop={shop} meta="distance" onClick={onSelectShop} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
