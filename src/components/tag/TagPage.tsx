'use client'

import Link from 'next/link'
import { Taku } from '@/components/tds'
import { Shop } from '@/types/shop'
import { Tag } from '@/types/tag'
import { ROUTES } from '@/lib/constants/routes'
import ShopCard from '@/components/shop/ShopCard'

interface Props {
  tag: Tag
  shops: Shop[]
}

export default function TagPage({ tag, shops }: Props) {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
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