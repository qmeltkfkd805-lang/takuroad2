import WorkRequestForm from '@/components/work/WorkRequestForm'

export const metadata = { title: '작품 추가 요청 · 타쿠로드' }

export default function Page() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 18px 60px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '0 0 8px' }}>작품 추가 요청</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
          타쿠로드에 없는 작품이 있으면 알려주세요. 확인 후 등록해 드려요.
          지금은 중복·오등록을 줄이기 위해 작품 등록을 관리자만 하고 있어요.
        </p>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 20px' }}>
        <WorkRequestForm />
      </div>
    </div>
  )
}
