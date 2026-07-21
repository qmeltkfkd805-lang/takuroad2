import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '제휴 문의 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="제휴 문의" description="매장·브랜드·이벤트 제휴를 환영합니다.">
      <div className="pending">
        <p>매장 등록, 이벤트 홍보, 브랜드 협업 등 제휴를 원하시면 아래 이메일로 연락 주세요. 제안 내용을 함께 보내주시면 빠르게 검토할게요.</p>
        <p style={{ marginTop: 12 }}>문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a></p>
      </div>
    </PolicyLayout>
  )
}