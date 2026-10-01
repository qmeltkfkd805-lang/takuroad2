import Link from 'next/link'
import PolicyLayout from '@/components/policy/PolicyLayout'
import ContactLinks from '@/components/common/ContactLinks'

export const metadata = { title: '권리자 문의 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="권리자 문의" description="권리자의 이미지 삭제·정보 수정·권리 침해 요청을 받습니다." updated="2026년 10월 1일">
      <h2>이런 경우 요청해 주세요</h2>
      <ul>
        <li>본인이 권리를 가진 작품·이미지·상표·사진이 허락 없이 쓰였을 때</li>
        <li>본인의 코스(인스타그램·블로그 등)를 출처 없이 옮긴 루트가 있을 때 — 출처 표시, 루트 넘겨받기, 숨김을 요청할 수 있습니다</li>
        <li>본인 또는 본인 매장에 대한 정보가 사실과 달라 고쳐야 할 때</li>
        <li>본인의 얼굴·개인정보가 동의 없이 올라와 있을 때</li>
      </ul>

      <h2>요청 방법</h2>
      <p>
        아래 <strong>문의하기</strong>에서 문의 유형을 <strong>권리자 요청</strong>으로 골라 접수해 주세요. 다음 내용을 함께 적어 주시면 처리가 빨라집니다.
      </p>
      <ul>
        <li>대상 페이지 주소</li>
        <li>침해받은 권리나 고쳐야 할 내용에 대한 설명</li>
        <li>권리 관계를 확인할 수 있는 자료 (권리자 증명, 위임 관계, 원본 게시물 주소 등)</li>
        <li>답변 받을 이메일</li>
      </ul>

      <h2>처리 절차</h2>
      <ul>
        <li>접수되면 내용을 확인하고, 침해가 분명한 경우 먼저 게시물을 숨긴 뒤 검토합니다.</li>
        <li>확인이 끝나면 수정·삭제·출처 표시·작성자 넘기기 등 필요한 조치를 하고 결과를 알려드립니다.</li>
        <li>게시한 이용자에게도 조치 사실을 알리며, 게시자는 정당한 권리가 있다면 이의를 제기할 수 있습니다.</li>
      </ul>
      <p>저작권에 대한 자세한 안내는 <Link href="/policies/copyright">저작권 안내</Link>를 참고해 주세요.</p>

      <ContactLinks />
    </PolicyLayout>
  )
}
