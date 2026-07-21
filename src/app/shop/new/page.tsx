import Link from 'next/link'
import ShopForm from '@/components/shop/ShopForm'

export const metadata = { title: '샵 등록 · 타쿠로드' }

export default function ShopNewPage() {
  return (
    <div>
      <Link href="/shop/claim" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        maxWidth: 720, margin: '24px auto 0', padding: '16px 20px',
        background: 'var(--accent-l)', borderRadius: 14, textDecoration: 'none',
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          🏪 이미 등록된 내 매장의 사장님이신가요?
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          사장님 인증 →
        </span>
      </Link>
      <ShopForm mode="create" />
    </div>
  )
}