'use client'
/* 📱 홈 검색창 아래 바로가기 — 샵 / 이벤트 / 루트 / 작품 (탐색의 각 메뉴로).
   마지막으로 보던 화면이 있으면 그리로(검색어·필터 유지), 없으면 각 메뉴 첫 화면.
   PC(마우스 기기)는 왼쪽 사이드바에 같은 메뉴가 있어 숨긴다. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EXPLORE, ExploreKey, lastExploreUrl } from '@/lib/nav/explore'
import styles from './HomeShortcuts.module.css'

export default function HomeShortcuts() {
  const [hrefs, setHrefs] = useState<Record<ExploreKey, string>>(
    () => Object.fromEntries(EXPLORE.map(e => [e.key, e.root])) as Record<ExploreKey, string>,
  )
  useEffect(() => {
    setHrefs(Object.fromEntries(EXPLORE.map(e => [e.key, lastExploreUrl(e.key)])) as Record<ExploreKey, string>)
  }, [])

  return (
    <nav className={styles.row} aria-label="바로가기">
      {EXPLORE.map(e => (
        <Link key={e.key} href={hrefs[e.key]} className={styles.item}>
          <span className={styles.icon}>{e.icon}</span>
          <span className={styles.label}>{e.label}</span>
        </Link>
      ))}
    </nav>
  )
}
