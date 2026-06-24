'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkAffinityButton from './WorkAffinityButton'
import WorkStateButton from './WorkStateButton'
import { AVAILABILITY_LABEL, Availability } from '@/services/shopProductService'

const AVAILABILITY_COLOR: Record<Availability, string> = {
  unknown: 'var(--muted)', not_sold: 'var(--muted)', sold_out: 'var(--red)',
  few: '#eab308', normal: 'var(--accent)', many: 'var(--green)',
}

interface WorkHomeProps {
  tag: { id: string; name: string; slug: string }
  goods: any[]
  shops: any[]
  routes: any[]
}

export default function WorkHomePage({ tag, goods, shops, routes }: WorkHomeProps) {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* 헤더 */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
      }}>
        <button
          onClick={() => {
            if (window.history.length > 1) router.back()
            else router.push('/my-works')
          }}
          style={{
            background: 'none', border: 'none', fontSize: '20px',
            color: 'var(--muted)', cursor: 'pointer', marginBottom: '8px',
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text)', margin: '0 0 14px' }}>
          {tag.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <WorkAffinityButton tagId={tag.id} />
          </div>
          <WorkStateButton tagId={tag.id} />
        </div>
      </div>

      {/* 🛍️ 판매 중인 굿즈 */}
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
          🛍️ 판매 중인 굿즈 {goods.length > 0 && `${goods.length}개`}
        </h2>
        {goods.length === 0 ? (
          <EmptyBox text="아직 등록된 굿즈가 없어요" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {goods.map(g => (
              <div key={g.id} style={{
                padding: '12px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ fontSize: '20px' }}>{g.goodsIcon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                    {g.character ? `${g.character} ` : ''}{g.goodsType}
                  </div>
                  <Link href={`/shop/${g.shopSlug}`} style={{
                    fontSize: '12px', color: 'var(--muted)', textDecoration: 'none',
                  }}>
                    📍 {g.shopName}
                  </Link>
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: 700,
                  color: AVAILABILITY_COLOR[g.availability as Availability],
                }}>
                  {AVAILABILITY_LABEL[g.availability as Availability]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📍 관련 굿즈샵 */}
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
          📍 관련 굿즈샵 {shops.length > 0 && `${shops.length}곳`}
        </h2>
        {shops.length === 0 ? (
          <EmptyBox text="아직 등록된 샵이 없어요" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shops.map(shop => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  textDecoration: 'none', color: 'var(--text)',
                  fontSize: '14px', fontWeight: 700,
                }}
              >
                {shop.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 🗺️ 추천 루트 */}
      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
          🗺️ 추천 루트 {routes.length > 0 && `${routes.length}개`}
        </h2>
        {routes.length === 0 ? (
          <EmptyBox text="아직 추천 루트가 없어요" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {routes.map(r => (
              <Link
                key={r.id}
                href={`/route/${r.share_token}`}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  textDecoration: 'none', color: 'var(--text)',
                  display: 'block',
                }}
              >
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
        )}
      </div>
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{
      padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px',
      background: 'var(--surface2)', borderRadius: 'var(--r-sm)',
    }}>
      {text}
    </div>
  )
}