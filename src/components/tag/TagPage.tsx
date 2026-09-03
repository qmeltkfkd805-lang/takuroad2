'use client'

import Link from 'next/link'
import { Taku } from '@/components/tds'
import { Shop } from '@/types/shop'
import { Tag } from '@/types/tag'
import { ROUTES } from '@/lib/constants/routes'
import ShopCard from '@/components/shop/ShopCard'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface Props {
  tag: Tag
  shops: Shop[]
}

export default function TagPage({ tag, shops }: Props) {
  /* 이 페이지 헤더가 붙는 위치는 기기에 따라 다르다.
     데스크톱: 전역 헤더(AppShell .header — 높이 60 + 테두리 1, z-index 30)가 보이므로
               그 아래(top 61)에, 그리고 그보다 낮은 z-index 로 붙는다.
               예전처럼 top 0 / zIndex 50 이면 전역 헤더를 덮어서 상단바의
               알림 드롭다운까지 가려버린다.
     모바일:   AppShell 이 /tag 에서 전역 헤더를 숨기므로(showHeaderMobile 은
               홈·지도·내작품만) 화면 맨 위에 그대로 붙인다. 여기서 top 61 을 주면
               위쪽에 빈 공간이 생긴다. */
  const isDesktop = useIsDesktop()

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: isDesktop ? 61 : 0, zIndex: isDesktop ? 20 : 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Link href={ROUTES.home} style={{
          background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
          textDecoration: 'none', color: 'var(--text)',
        }}>←</Link>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 900 }}>#{tag.name}</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            관련 샵 {shops.length}개
          </p>
        </div>
      </div>

      {/* 샵 목록 */}
      {shops.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}><Taku pose="shopping" size={96} /></div>
          <p style={{ fontWeight: 900, fontSize: '16px', marginBottom: '8px' }}>
            #{tag.name} 관련 샵이 없어요
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
            아직 등록된 샵이 없어요. 첫 번째로 등록해보세요!
          </p>
          <Link href={ROUTES.shopNew} style={{
            padding: '12px 24px', borderRadius: '12px',
            background: 'var(--accent)', color: '#fff',
            fontWeight: 700, fontSize: '14px',
          }}>
            샵 등록하기
          </Link>
        </div>
      ) : (
        <div>
          {shops.map(shop => (
            <Link key={shop.id} href={ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <ShopCard
                shop={shop}
                isActive={false}
                onClick={() => {}}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}