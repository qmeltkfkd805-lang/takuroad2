import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '공지사항 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="공지사항" description="타쿠로드의 업데이트와 소식을 전합니다.">
      <div className="pending">
        <p>서비스 업데이트, 점검 안내, 이벤트 소식 등을 이곳에서 전해드릴 예정이에요. 아직 등록된 공지가 없어요.</p>
        <p style={{ marginTop: 12 }}>문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a></p>
      </div>
    </PolicyLayout>
  )
}