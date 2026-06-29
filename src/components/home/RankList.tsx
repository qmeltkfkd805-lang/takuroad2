'use client'

import Link from 'next/link'
import styles from './RankList.module.css'

export interface RankItem {
  id: string
  name: string
  href: string
  affinity?: 'favorite' | 'interest' | null  // 내가 최애/관심이면 표시
}

// 발견(Discovery) 리스트 — 실검 스타일 순위. 카드 아님, 텍스트 밀도 높게.
// 2열(1~5 / 6~10), TOP3 강조. 인기 작품·샵·검색어 등에 재사용.
export default function RankList({ items }: { items: RankItem[] }) {
  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <Link key={item.id} href={item.href} className={styles.row}>
          <span className={i < 3 ? styles.rankTop : styles.rank}>{i + 1}</span>
          <span className={styles.name}>{item.name}</span>
          {item.affinity === 'favorite' && (
            <svg className={styles.aff} viewBox="0 0 24 24" style={{ fill: '#FF6B6B' }}><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
          )}
          {item.affinity === 'interest' && (
            <svg className={styles.aff} viewBox="0 0 24 24" style={{ fill: '#FFD166' }}><path d="M12 3.5l2.5 5.6 6.1.5-4.6 4 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4 6.1-.5z" /></svg>
          )}
        </Link>
      ))}
    </div>
  )
}
