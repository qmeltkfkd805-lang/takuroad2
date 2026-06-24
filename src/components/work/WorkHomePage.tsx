'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WorkAffinityButton from './WorkAffinityButton'

interface WorkHomeProps {
  tag: { id: string; name: string; slug: string }
  shops: any[]
}

export default function WorkHomePage({ tag, shops }: WorkHomeProps) {
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
        {/* 작품 만나는 화면 → 관계 시작 버튼 */}
        <WorkAffinityButton tagId={tag.id} />
      </div>

      {/* 관련 굿즈샵 */}
      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
          📍 관련 굿즈샵 {shops.length > 0 && `${shops.length}곳`}
        </h2>
        {shops.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px',
            background: 'var(--surface2)', borderRadius: 'var(--r-sm)',
          }}>
            아직 등록된 샵이 없어요
          </div>
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
    </div>
  )
}