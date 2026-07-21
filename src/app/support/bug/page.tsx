import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '버그 신고 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="버그 신고" description="오류를 발견하면 알려주세요. 빠르게 고칠게요.">
      <div className="pending">
        <p>이용 중 오류나 이상한 동작을 발견하면 아래 이메일로 알려주세요. 어떤 화면에서 어떤 문제가 있었는지 함께 적어주시면 큰 도움이 돼요.</p>
        <p style={{ marginTop: 12 }}>문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a></p>
      </div>
    </PolicyLayout>
  )
}