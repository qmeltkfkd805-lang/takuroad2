import PolicyLayout from '@/components/policy/PolicyLayout'
import ContactLinks from '@/components/common/ContactLinks'

export const metadata = { title: '권리자 문의 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="권리자 문의" description="권리자의 이미지 삭제·정보 수정·권리 침해 요청을 받습니다.">
      <div className="pending">
        <p>본인이 권리를 가진 작품·이미지·상표 등이 동의 없이 사용되었다면 아래 이메일로 요청해 주세요. 대상 페이지 주소와 권리 관계를 함께 알려주시면 확인 후 수정 또는 삭제 등 필요한 조치를 신속히 진행합니다.</p>
      <ContactLinks />
      </div>
    </PolicyLayout>
  )
}