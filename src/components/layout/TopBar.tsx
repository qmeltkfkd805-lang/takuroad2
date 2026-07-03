'use client'
import { useState, useEffect, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getUnreadCount } from '@/services/notificationService'
import { getMyLevelInfo } from '@/services/expService'
import { globalSearch, GlobalSearchResult } from '@/services/globalSearchService'
import type { ActiveWork } from '@/services/activeWorksService'
import styles from './TopBar.module.css'

const EMPTY: GlobalSearchResult = { shops: [], products: [], tags: [], characters: [], totalCount: 0 }

export default function TopBar({ trendingWorks = [] }: { trendingWorks?: ActiveWork[] }) {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [q, setQ] = useState('')
  const [unread, setUnread] = useState(0)
  const [level, setLevel] = useState<number | null>(null)

  const [results, setResults] = useState<GlobalSearchResult>(EMPTY)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { setUnread(0); setLevel(null); return }
    getUnreadCount(user.id).then(setUnread).catch(() => {})
    getMyLevelInfo(user.id).then(i => setLevel(i.level)).catch(() => {})
  }, [user])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults(EMPTY); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await globalSearch(term, user?.id ?? null)
        setResults(r)
      } catch {
        setResults(EMPTY)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, user])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    goAll()
  }
  function goAll() {
    const term = q.trim()
    if (term) { setOpen(false); router.push('/search?q=' + encodeURIComponent(term)) }
  }
  function go(href: string) {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  const term = q.trim()
  const hasAny = results.tags.length + results.shops.length + results.products.length > 0
  const showDrop = open && term.length > 0

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap} ref={wrapRef}>
        <form className={styles.search} onSubmit={onSearch}>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="작품, 샵, 지역, 이벤트 검색"
          />
        </form>

        {showDrop && (
          <div className={styles.drop}>
            {searching && !hasAny && <div className={styles.dropEmpty}>검색 중...</div>}
            {!searching && !hasAny && <div className={styles.dropEmpty}>검색 결과가 없어요</div>}

            {results.tags.length > 0 && (
              <div className={styles.dropSection}>
                <div className={styles.dropLabel}>작품</div>
                {results.tags.map(t => (
                  <button key={t.id} type="button" className={styles.dropItem} onClick={() => go(`/work/${t.slug}`)}>
                    <span className={styles.dropIcon}>🎬</span>{t.name}
                  </button>
                ))}
              </div>
            )}

            {results.shops.length > 0 && (
              <div className={styles.dropSection}>
                <div className={styles.dropLabel}>샵</div>
                {results.shops.map(s => (
                  <button key={s.id} type="button" className={styles.dropItem} onClick={() => go(`/shop/${s.slug}`)}>
                    <span className={styles.dropIcon}>🏪</span>{s.name}
                  </button>
                ))}
              </div>
            )}

            {results.products.length > 0 && (
              <div className={styles.dropSection}>
                <div className={styles.dropLabel}>굿즈</div>
                {results.products.slice(0, 5).map((p, i) => (
                  <button key={i} type="button" className={styles.dropItem} onClick={() => go(`/shop/${p.shopSlug}`)}>
                    <span className={styles.dropIcon}>🛍️</span>
                    <span className={styles.dropProduct}>
                      <span>{p.tagName} {p.goodsTypeName}</span>
                      <span className={styles.dropSub}>{p.shopName}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {term.length > 0 && (
              <button type="button" className={styles.dropAll} onClick={goAll}>
                '{term}' 전체 결과 보기 →
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.right}>
        {user ? (
          <>
            <Link href="/notifications" className={styles.iconBtn} aria-label="알림">
              <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <Link href="/profile" className={styles.user}>
              <span className={styles.avatar}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.nickname?.[0] ?? '?')}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{profile?.nickname ?? '사용자'}</span>
                {level != null && <span className={styles.userLv}>Lv.{level}</span>}
              </span>
            </Link>
          </>
        ) : (
          <Link href="/login" className={styles.login}>로그인</Link>
        )}
      </div>
    </div>
  )
}
