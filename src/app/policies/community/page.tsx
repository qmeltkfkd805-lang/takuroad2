import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '커뮤니티 운영정책 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="커뮤니티 운영정책" description="모두가 즐거운 커뮤니티를 위한 약속이에요.">
      <div className="pending">
        <p>욕설·비방·차별·스팸·음란물·타인의 권리 침해 등은 제한돼요. 건강한 덕질 문화를 위한 상세 운영정책을 정리해 올릴 예정이에요.</p>
        <p style={{ marginTop: 12 }}>문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a></p>
      </div>
    </PolicyLayout>
  )
}