'use client'
import { useState, useEffect, useRef, useMemo, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { UserAvatar, UserTitle } from '@/components/cosmetic/UserFace'
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead, getNotificationLink, Notification } from '@/services/notificationService'
import { getMyLevelInfo } from '@/services/expService'
import { globalSearch, GlobalSearchResult } from '@/services/globalSearchService'
import { Icon } from '@/components/tds/Icon'
import { WorkIcon } from '@/components/tds/WorkIcon'
import AppIcon from '@/components/tds/AppIcon'
import type { ActiveWork } from '@/services/activeWorksService'
import styles from './TopBar.module.css'

const EMPTY: GlobalSearchResult = { shops: [], products: [], tags: [], characters: [], totalCount: 0 }

type Suggestion = { kind: 'work' | 'shop' | 'goods'; label: string; href: string; sub?: string }
const TYPE_RANK: Record<string, number> = { work: 0, shop: 1, goods: 2 }
const KIND_ICON: Record<string, string> = { work: 'work', shop: 'colorshop', goods: 'colorgift' }
const NOTI_ICON: Record<string, string> = { review_comment: 'commentbox', shop_comment: 'commentbox', comment: 'commentbox', post_comment: 'commentbox', like: 'heart', post_like: 'heart', review_like: 'heart', check_in: 'pushpin', checkin: 'pushpin', goods: 'gift', goods_restock: 'gift', product_restock: 'gift', shop_approved: 'shop', shop_review: 'pencil', verify_approved: 'check', verify_rejected: 'close', event: 'event', notice: 'megaphone', announcement: 'megaphone', report: 'warning', report_resolved: 'warning', post_report: 'warning', follow: 'bell', follow_post: 'bell', follow_route: 'bell', badge: 'medal', badge_earned: 'medal', route_completed: 'road', review: 'pencil' }
const stripSpaces = (s: string) => s.toLowerCase().replace(/\s+/g, '')

function buildSuggestions(r: GlobalSearchResult, term: string): Suggestion[] {
  const t = stripSpaces(term)
  const items: Suggestion[] = []
  r.tags.forEach(x => items.push({ kind: 'work', label: x.name, href: `/work/${x.slug}` }))
  r.shops.forEach(x => items.push({ kind: 'shop', label: x.name, href: `/shop/${x.slug}` }))
  r.products.forEach(p => items.push({ kind: 'goods', label: `${p.tagName} ${p.goodsTypeName}`.trim(), href: `/shop/${p.shopSlug}`, sub: p.shopName }))
  const seen = new Set<string>()
  const uniq = items.filter(it => { const k = it.kind + '|' + it.label; if (seen.has(k)) return false; seen.add(k); return true })
  uniq.sort((a, b) => {
    const ea = stripSpaces(a.label) === t ? 0 : 1, eb = stripSpaces(b.label) === t ? 0 : 1
    if (ea !== eb) return ea - eb
    const pa = stripSpaces(a.label).startsWith(t) ? 0 : 1, pb = stripSpaces(b.label).startsWith(t) ? 0 : 1
    if (pa !== pb) return pa - pb
    if (TYPE_RANK[a.kind] !== TYPE_RANK[b.kind]) return TYPE_RANK[a.kind] - TYPE_RANK[b.kind]
    return a.label.length - b.label.length
  })
  return uniq.slice(0, 8)
}

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
  const [notiOpen, setNotiOpen] = useState(false)
  const [notiList, setNotiList] = useState<Notification[]>([])
  const notiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { setUnread(0); setLevel(null); return }
    const _tick = () => getUnreadCount(user.id).then(setUnread).catch(() => {})
    _tick()
    const _iv = setInterval(_tick, 45000)
    window.addEventListener('focus', _tick)
    window.addEventListener('noti-read', _tick)
    getMyLevelInfo(user.id).then(i => setLevel(i.level)).catch(() => {})
  }, [user])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults(EMPTY); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await globalSearch(term, user?.id ?? null)) }
      catch { setResults(EMPTY) }
      finally { setSearching(false) }
    }, 150)
    return () => clearTimeout(t)
  }, [q, user])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setNotiOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setNotiOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const term = q.trim()
  const suggestions = useMemo(() => buildSuggestions(results, term), [results, term])
  const showDrop = open && term.length > 0

  function onSearch(e: FormEvent) { e.preventDefault(); goAll() }
  function goAll() { if (term) { setOpen(false); router.push('/search?q=' + encodeURIComponent(term)) } }
  function go(href: string) { setOpen(false); setQ(''); router.push(href) }

  function toggleNoti() {
    const next = !notiOpen
    setNotiOpen(next)
    if (next && user) getNotifications(user.id).then(setNotiList).catch(() => {})
  }
  async function onNotiClick(n: Notification) {
    if (!n.is_read) {
      await markAsRead(n.id)
      setNotiList(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    const dest = getNotificationLink(n)
    setNotiOpen(false)
    if (dest && dest !== '/') router.push(dest)
  }
  async function onNotiAllRead() {
    if (!user) return
    await markAllAsRead(user.id)
    setNotiList(prev => prev.map(x => ({ ...x, is_read: true })))
    setUnread(0)
  }

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
            {searching && suggestions.length === 0 && <div className={styles.dropEmpty}>검색 중...</div>}
            {!searching && suggestions.length === 0 && <div className={styles.dropEmpty}>검색 결과가 없어요</div>}

            {suggestions.map((s, i) => (
              <button key={i} type="button" className={styles.dropItem} onClick={() => go(s.href)}>
                {s.kind === 'work' ? <WorkIcon size={18} /> : <Icon name={KIND_ICON[s.kind]} size={18} />}
                <span className={styles.dropText}>{s.label}</span>
                {s.sub && <span className={styles.dropSub}>{s.sub}</span>}
              </button>
            ))}

            {term && (
              <button type="button" className={styles.dropAll} onClick={goAll}>
                🔍 '{term}' 전체 검색
              </button>
            )}
            <button type="button" className={styles.dropItem} onClick={() => go('/work/new')} style={{ color: 'var(--accent)', fontWeight: 800 }}>
              <WorkIcon size={18} />
              <span className={styles.dropText}>찾는 작품이 없나요? 직접 작품 등록하기</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {user ? (
          <>
            <div ref={notiRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={toggleNoti}
                className={styles.iconBtn}
                aria-label="알림"
                style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
              >
                <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
              </button>

              {notiOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
                  width: 340, maxWidth: '86vw', maxHeight: 460, overflowY: 'auto',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.14)',
                }}>
                  <div style={{
                    position: 'sticky', top: 0, background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                  }}>
                    <b style={{ fontSize: 14 }}>알림</b>
                    {notiList.some(n => !n.is_read) && (
                      <button type="button" onClick={onNotiAllRead}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}>
                        모두 읽음
                      </button>
                    )}
                  </div>

                  {notiList.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                      아직 알림이 없어요
                    </div>
                  ) : (
                    notiList.slice(0, 15).map(n => (
                      <button key={n.id} type="button" onClick={() => onNotiClick(n)}
                        style={{
                          display: 'flex', gap: 10, width: '100%', textAlign: 'left',
                          padding: '12px 14px', border: 'none', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
                          background: n.is_read ? 'var(--surface)' : 'var(--surface2)',
                        }}>
                        <AppIcon name={NOTI_ICON[n.type] ?? 'bell'} size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 800, marginBottom: 2 }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>{n.body}</div>}
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />}
                      </button>
                    ))
                  )}

                  <button type="button" onClick={() => { setNotiOpen(false); router.push('/notifications') }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'center', padding: '12px',
                      border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
                      background: 'var(--surface)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                    }}>
                    전체 보기
                  </button>
                </div>
              )}
            </div>

            <Link href="/profile" className={styles.user}>
              <span className={styles.avatar}>
                <UserAvatar
                  userId={user?.id}
                  src={profile?.avatar_url}
                  name={profile?.nickname}
                  size={30}
                />
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{profile?.nickname ?? '사용자'}</span>
                <UserTitle userId={user?.id} />
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