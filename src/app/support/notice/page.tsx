import ContactLinks from '@/components/common/ContactLinks'
import NoticeBoard from '@/components/notice/NoticeBoard'

export const metadata = { title: '공지사항 · 타쿠로드' }

export default function Page() {
  return (
    <div style={{ width: '100%', padding: '40px 40px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px' }}>공지사항</h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', margin: 0 }}>타쿠로드의 업데이트와 소식을 전합니다.</p>
      </div>

      <NoticeBoard />

      <div style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
        <ContactLinks />
      </div>
    </div>
  )
}