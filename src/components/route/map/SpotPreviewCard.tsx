'use client'
import Link from 'next/link'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import styles from './SpotPreviewCard.module.css'

/* 선택된 스팟 정보 카드 — PC: 지도 하단 플로팅 / 모바일: 하단 미니시트.
   지도를 과도하게 가리지 않도록 이름·주소·상세보기 정도만. */
export default function SpotPreviewCard({
  shop, order, onClose,
}: {
  shop: any
  order: number | null
  onClose: () => void
}) {
  if (!shop) return null
  const img = shop.shop_images?.[0]?.image_url
  const cats: string[] = Array.isArray(shop.cats) ? shop.cats : []
  return (
    <div className={styles.card} role="dialog" aria-label={`${shop.name} 정보`}>
      <div className={styles.thumb}>{img ? <img src={img} alt="" /> : <span className={styles.noImg} />}</div>
      <div className={styles.body}>
        <div className={styles.top}>
          {order != null && <span className={styles.order}>{order}</span>}
          <span className={styles.name}>{shop.name}</span>
        </div>
        {shop.addr && <div className={styles.addr}>{shop.addr}</div>}
        {(() => { const fl = shop.floor_info || [shop.floor, shop.unit].filter(Boolean).join(' '); return fl ? <span className={styles.floor}>{fl}</span> : null })()}
        {shop.places?.access_note && <div className={styles.note}>가는 길 · {shop.places.access_note}</div>}
        {cats.length > 0 && <div className={styles.tags}>{cats.slice(0, 2).map(c => { const cc = (CATEGORY_NAME_MAP as any)[c]; return <span key={c} className={styles.tag} style={cc ? { color: cc.color, background: cc.bgColor } : undefined}>{c}</span> })}</div>}
      </div>
      <Link href={`/shop/${shop.slug}`} className={styles.detail}>상세 보기 ›</Link>
      <button className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
    </div>
  )
}
