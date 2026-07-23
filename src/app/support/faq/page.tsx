import PolicyLayout from '@/components/policy/PolicyLayout'
import ContactLinks from '@/components/common/ContactLinks'

export const metadata = { title: '자주 묻는 질문 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="자주 묻는 질문" description="타쿠로드 이용에 자주 나오는 질문을 모았어요.">
      <div className="pending">
        <p>회원가입, 매장 등록, 후기·커뮤니티 이용 등 자주 묻는 질문을 정리해 올릴 예정이에요.</p>
      <ContactLinks />
      </div>
    </PolicyLayout>
  )
}