import SuggestForm from '@/components/suggest/SuggestForm'
import MySuggestions from '@/components/suggest/MySuggestions'

export const metadata = { title: '제안하기 · 타쿠로드' }

export default function Page() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 18px 60px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '0 0 8px' }}>제안하기</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          타쿠로드에 &lsquo;이런 기능 있으면 좋겠다&rsquo; 싶은 아이디어를 남겨주세요. 하나하나 읽고 반영을 검토해요.
        </p>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 20px' }}>
        <SuggestForm />
      </div>
      <MySuggestions />
    </div>
  )
}
