'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import AdminIcon, { AdminIconName } from './AdminIcon'
import styles from './adminSidebar.module.css'

/* 관리자 좌측 고정 사이드바.
   탭 값(AdminPage의 Tab)과 라우팅은 그대로 두고 표시만 바꾼다. 메뉴는 15개 전부 유지. */

export interface SidebarCounts {
  /** 각 탭의 미처리 건수. null이면 아직 안 왔거나 조회 실패 → 배지 대신 '—' */
  [tab: string]: number | null | undefined
}

interface MenuItem { tab: string; label: string; icon: AdminIconName }
interface MenuGroup { key: string; label: string; items: MenuItem[] }

/* 시안의 3그룹. 시안에 없는 '샵 관리'는 삭제하지 않고 콘텐츠에 넣었다.
   시안의 '작품 정보 관리'는 대응하는 탭이 없어 만들지 않았다. */
const GROUPS: MenuGroup[] = [
  {
    key: 'content', label: '콘텐츠',
    items: [
      { tab: 'hero',       label: '홈 히어로 관리', icon: 'hero' },
      { tab: 'works',      label: '작품 관리',      icon: 'work' },
      { tab: 'shopmanage', label: '샵 관리',        icon: 'shop' },
      { tab: 'places',     label: '장소 관리',      icon: 'place' },
      { tab: 'routes',     label: '추천 루트',      icon: 'route' },
      { tab: 'events',     label: '시즌 이벤트',    icon: 'season' },
    ],
  },
  {
    key: 'review', label: '검수 · 승인',
    items: [
      { tab: 'shops',       label: '샵 승인',      icon: 'approve' },
      { tab: 'verify',      label: '인증 심사',    icon: 'verify' },
      { tab: 'reported',    label: '샵 신고',      icon: 'flagShop' },
      { tab: 'postreports', label: '게시글 신고',  icon: 'flagPost' },
    ],
  },
  {
    key: 'user', label: '사용자 · 문의',
    items: [
      { tab: 'members',     label: '회원',       icon: 'member' },
      { tab: 'contacts',    label: '문의 관리',  icon: 'contact' },
      { tab: 'partners',    label: '제휴 문의',  icon: 'partner' },
      { tab: 'suggestions', label: '제안 관리',  icon: 'idea' },
    ],
  },
]

const groupOf = (tab: string) => GROUPS.find(g => g.items.some(i => i.tab === tab))?.key ?? null

export default function AdminSidebar({ tab, counts, onSelect, onViewSite }: {
  tab: string
  counts: SidebarCounts
  onSelect: (tab: string) => void
  /** 하단 '사이트 보기' — 새 탭으로 연다 */
  onViewSite: () => void
}) {
  // 현재 메뉴가 속한 그룹은 자동으로 열린다
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [drawer, setDrawer] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  const activeGroup = useMemo(() => groupOf(tab), [tab])

  /* 현재 메뉴가 든 그룹은 자동으로 펼친다.
     effect가 아니라 "렌더 중 파생 상태 조정"으로 처리한다 — effect에서 setState를 부르면
     한 프레임 늦게 반영되고 렌더가 한 번 더 돈다(react-hooks/set-state-in-effect). */
  const [prevTab, setPrevTab] = useState(tab)
  if (tab !== prevTab) {
    setPrevTab(tab)
    if (activeGroup && collapsed[activeGroup]) {
      setCollapsed(c => ({ ...c, [activeGroup]: false }))
    }
  }

  // 드로어: ESC로 닫기 + 열려 있는 동안 배경 스크롤 잠금 + 포커스 이동
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawer])

  // 닫힐 때 열었던 버튼으로 포커스를 되돌린다
  const closeDrawer = () => { setDrawer(false); openerRef.current?.focus() }

  const select = (t: string) => { onSelect(t); closeDrawer() }

  const nav = (
    <>
      <div className={styles.brand}>
        <span className={styles.brandName}>TAKUROAD</span>
        <span className={styles.brandSuffix}>관리자</span>
      </div>

      <nav className={styles.scroll} aria-label="관리자 메뉴">
        <button
          type="button"
          className={`${styles.item} ${tab === 'dashboard' ? styles.itemOn : ''}`}
          aria-current={tab === 'dashboard' ? 'page' : undefined}
          onClick={() => select('dashboard')}
        >
          <AdminIcon name="dashboard" size={18} />
          <span className={styles.itemLabel}>대시보드</span>
        </button>

        {GROUPS.map(g => {
          const open = !collapsed[g.key]
          return (
            <section key={g.key} className={styles.group}>
              <button
                type="button"
                className={styles.groupHead}
                aria-expanded={open}
                aria-controls={`admin-group-${g.key}`}
                onClick={() => setCollapsed(c => ({ ...c, [g.key]: open }))}
              >
                <span>{g.label}</span>
                <AdminIcon name="chevron" size={15} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
              </button>

              <div id={`admin-group-${g.key}`} hidden={!open}>
                {g.items.map(it => {
                  const n = counts[it.tab]
                  const on = tab === it.tab
                  return (
                    <button
                      key={it.tab}
                      type="button"
                      className={`${styles.item} ${on ? styles.itemOn : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={() => select(it.tab)}
                    >
                      <AdminIcon name={it.icon} size={18} />
                      <span className={styles.itemLabel}>{it.label}</span>
                      {/* 실제 미처리 건이 있을 때만 배지. 0건과 조회 실패(null)는 숨긴다 */}
                      {typeof n === 'number' && n > 0 && (
                        <span className={styles.badge} aria-label={`미처리 ${n}건`}>{n > 99 ? '99+' : n}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className={styles.foot}>
        <button type="button" className={styles.footItem} onClick={() => { onViewSite(); closeDrawer() }}>
          <AdminIcon name="external" size={17} />
          <span>사이트 보기</span>
        </button>
        {/* 시안에는 있으나 대응하는 탭이 없다. 새 기능을 만들지 않기로 해서 비활성으로 자리만 둔다 */}
        <button type="button" className={styles.footItem} disabled aria-disabled="true" title="준비 중">
          <AdminIcon name="settings" size={17} />
          <span>관리자 설정</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* 모바일 상단 바 — 드로어 열기 */}
      <div className={styles.mobileBar}>
        <button
          ref={openerRef}
          type="button"
          className={styles.iconBtn}
          aria-label="관리자 메뉴 열기"
          aria-expanded={drawer}
          aria-haspopup="dialog"
          onClick={() => setDrawer(true)}
        >
          <AdminIcon name="menu" size={22} />
        </button>
        <span className={styles.mobileTitle}>TAKUROAD 관리자</span>
      </div>

      {/* 데스크톱 고정 사이드바 */}
      <aside className={styles.side}>{nav}</aside>

      {/* 모바일 드로어 */}
      {drawer && (
        <div className={styles.overlay} onClick={closeDrawer}>
          <div
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="관리자 메뉴"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className={styles.drawerClose} aria-label="메뉴 닫기" onClick={closeDrawer}>
              <AdminIcon name="close" size={20} />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  )
}
