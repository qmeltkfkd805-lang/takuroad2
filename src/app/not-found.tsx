import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { Taku } from '@/components/tds'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: '20px' }}><Taku pose="map" size={110} /></div>
      <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>
        페이지를 찾을 수 없어요
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px' }}>
        주소가 잘못되었거나 삭제된 페이지예요.
      </p>
      <Link
        href={ROUTES.home}
        style={{
          padding: '12px 28px', borderRadius: '12px',
          background: 'var(--accent)', color: '#fff',
          fontWeight: 700, fontSize: '15px',
        }}
      >
        지도로 돌아가기
      </Link>
    </div>
  )
}
