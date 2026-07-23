'use client'
import Link from 'next/link'
import { Icon } from '@/components/tds/Icon'
import { Shop } from '@/types/shop'
import styles from './manage.module.css'

const MENUS = [
  { key: 'info', icon: 'receipt', label: '기본 정보', desc: '매장 이름·주소·연락처·소개', href: 'edit' },
  { key: 'hours', icon: 'clock', label: '영업시간', desc: '요일별 영업시간 관리', href: 'manage/hours' },
  { key: 'holiday', icon: 'bell', label: '휴무 공지', desc: '임시 휴무 안내', href: 'manage/holiday' },
  { key: 'events', icon: 'event', label: '이벤트', desc: '진행 중인 이벤트 등록', href: 'manage/events' },
  { key: 'stock', icon: 'box', label: '입고 소식', desc: '재입고·신상품 소식 등록', href: 'manage/events/new?type=restock' },
  { key: 'photos', icon: 'photo', label: '사진 관리', desc: '매장 사진 추가·정렬', href: 'manage/photos' },
]

export default function ShopManagePage({ shop }: { shop: Shop }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.badge}>매장 관리</span>
        <h1 className={styles.title}>{shop.name}</h1>
        <p className={styles.desc}>인증된 사장님으로서 매장을 직접 관리할 수 있어요.</p>
        <Link href={`/shop/${shop.slug}`} className={styles.backLink}>← 매장 페이지로</Link>
      </div>

      <div className={styles.grid}>
        {MENUS.map(m => (
          (m as any).href ? (
            <Link key={m.key} href={`/shop/${shop.slug}/${(m as any).href}`} className={styles.card} style={{ textDecoration: 'none' }}>
              <span className={styles.cardIcon}><Icon name={m.icon} size={30} /></span>
              <div className={styles.cardBody}>
                <div className={styles.cardLabel}>{m.label}</div>
                <div className={styles.cardDesc}>{m.desc}</div>
              </div>
              <span className={styles.go}>→</span>
            </Link>
          ) : (
            <div key={m.key} className={styles.card}>
              <span className={styles.cardIcon}><Icon name={m.icon} size={30} /></span>
              <div className={styles.cardBody}>
                <div className={styles.cardLabel}>{m.label}</div>
                <div className={styles.cardDesc}>{m.desc}</div>
              </div>
              <span className={styles.soon}>준비 중</span>
            </div>
          )
        ))}
      </div>
    </div>
  )
}