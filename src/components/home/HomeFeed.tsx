'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyWorkRelationships } from '@/services/workRelationshipService'
import { WorkRelationship } from '@/types/work-relationship'
import { AFFINITY_LABEL } from '@/lib/constants/workRelationship'
import { pickHeroRelationship } from '@/lib/home/pickHeroRelationship'
import HeroSlot from './HeroSlot'
import { getProductsByTag } from '@/services/shopProductService'
import { getShopsByTag } from '@/services/shopService'
import ShopCard from '@/components/shop/ShopCard'
import { ROUTES } from '@/lib/constants/routes'
import { getEventsByTag } from '@/services/eventService'
import { pickWorkNews } from '@/lib/home/pickWorkNews'
import { FeedItem } from '@/lib/feed/types'
import HomeFeedCard from './HomeFeedCard'
import { SectionHeader, Icon } from '@/components/tds'
import styles from './HomeFeed.module.css'

const PALETTE = [
  { bg: '#EEEDFE', fg: '#3C3489' }, { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#FAECE7', fg: '#993C1D' }, { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#FBEAF0', fg: '#993556' }, { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#EAF3DE', fg: '#3B6D11' }, { bg: '#FCEBEB', fg: '#A32D2D' },
]
function workColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

interface HomeFeedProps {
  popularShops: any[]
  routes: any[]
  activeWorks: any[]
}

export default function HomeFeed({ popularShops, routes, activeWorks }: HomeFeedProps) {
  const { user } = useAuth()
  const [rels, setRels] = useState<WorkRelationship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyWorkRelationships(user.id).then(setRels).finally(() => setLoading(false))
  }, [user])

  // 최애 먼저, 그다음 좋아하는 작품 (관계 있는 것만)
  const myWorks = rels
    .filter(r => r.affinity)
    .sort((a, b) => (a.affinity === 'favorite' ? 0 : 1) - (b.affinity === 'favorite' ? 0 : 1))

  // 활발한 작품에 ❤️/⭐ 붙이기용
  const myAffinity = new Map(
    rels.filter(r => r.affinity).map(r => [r.work.id, r.affinity!])
  )

  // Hero — 오늘 가장 중요한 관계
  const heroPick = pickHeroRelationship(rels)
  const [heroCounts, setHeroCounts] = useState<{ goods: number; shops: number } | null>(null)

  useEffect(() => {
    if (!heroPick) { setHeroCounts(null); return }
    const { slug, id } = heroPick.relationship.work
    Promise.all([getProductsByTag(id), getShopsByTag(slug)])
      .then(([goods, shops]) => setHeroCounts({ goods: goods.length, shops: shops.length }))
  }, [heroPick?.relationship.work.id])

  // 내 작품들의 새 소식 (작품별 이벤트 → pickWorkNews → FeedItem)
  const [newsItems, setNewsItems] = useState<FeedItem[]>([])
  useEffect(() => {
    if (myWorks.length === 0) { setNewsItems([]); return }
    Promise.all(
      myWorks.map(r =>
        getEventsByTag(r.work.id)
          .then(events => pickWorkNews(r.work, events, r.affinity))
          .catch(() => pickWorkNews(r.work, [], r.affinity))
      )
    ).then(items => {
      // 새 소식 있는 작품(none 아님)을 앞으로 정렬
      const sorted = [...items].sort((a, b) => (a.kind === 'none' ? 1 : 0) - (b.kind === 'none' ? 1 : 0))
      setNewsItems(sorted)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWorks.map(r => r.work.id).join(',')])

  return (
    <div>
      {/* ❤️ 내 작품 */}
      <section style={{ padding: '20px 0 8px' }}>
        <SectionHeader title="내 최애 작품" tone="coral" icon={<Icon name="heart" size={20} />} actionLabel="전체 보기" onAction={() => { window.location.href = "/my-works" }} />
        {loading ? (
          <Muted>불러오는 중...</Muted>
        ) : !user ? (
          <PromptBox text="로그인하면 좋아하는 작품을 모아볼 수 있어요" href="/login" cta="로그인" />
        ) : myWorks.length === 0 ? (
          <PromptBox text="아직 좋아하는 작품이 없어요" href="/search" cta="작품 찾아보기" />
        ) : (
          <div className={styles.feedGrid}>
            {newsItems.slice(0, 5).map((item, i) => (
              <HomeFeedCard key={item.contextLabel ?? i} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* 🔥 이번 주 가장 활발한 작품 */}
      {activeWorks.length > 0 && (
        <section style={{ padding: '12px 16px' }}>
          <SectionTitle inset>🔥 이번 주 가장 활발한 작품</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeWorks.map((w, i) => {
              const aff = myAffinity.get(w.id)
              const icon = aff ? AFFINITY_LABEL[aff].icon : null
              return (
                <Link key={w.id} href={`/work/${w.slug}`} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  textDecoration: 'none', color: 'var(--text)',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--muted)', width: '18px' }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 700 }}>
                    {icon ? `${icon} ` : ''}{w.name}
                  </span>
                  <span style={{ fontSize: '16px', color: 'var(--muted)' }}>→</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* 🏪 많이 찾는 굿즈샵 */}
      {popularShops.length > 0 && (
        <section style={{ padding: '12px 16px' }}>
          <SectionTitle inset>🏪 많이 찾는 굿즈샵</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {popularShops.map(shop => (
              <Link key={shop.id} href={ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ShopCard shop={shop} isActive={false} onClick={() => {}} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 🧭 추천 루트 */}
      {routes.length > 0 && (
        <section style={{ padding: '12px 16px 32px' }}>
          <SectionTitle inset>🧭 추천 루트</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {routes.map(r => (
              <Link key={r.id} href={`/route/${r.share_token}`} style={{
                padding: '12px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                textDecoration: 'none', color: 'var(--text)', display: 'block',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  {r.is_official ? '⭐ ' : ''}{r.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  샵 {r.route_shops?.length ?? 0}곳
                  {r.profiles?.nickname ? ` · ${r.profiles.nickname}` : ''}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionTitle({ children, inset }: { children: React.ReactNode; inset?: boolean }) {
  return (
    <h2 style={{
      fontSize: '16px', fontWeight: 700, color: 'var(--text)',
      margin: '0 0 12px', padding: inset ? 0 : '0 16px',
    }}>
      {children}
    </h2>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: '14px' }}>{children}</div>
}

function PromptBox({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div style={{ margin: '0 16px', padding: '20px', borderRadius: 'var(--r-sm)', background: 'var(--surface2)', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>{text}</p>
      <Link href={href} style={{
        display: 'inline-block', padding: '9px 20px', borderRadius: 'var(--r-sm)',
        background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
      }}>
        {cta}
      </Link>
    </div>
  )
}