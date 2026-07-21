import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '개인정보처리방침 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout
      title="개인정보처리방침"
      description="타쿠로드가 수집하는 개인정보와 이용·보관 방식에 대한 안내입니다."
      updated="2026년 7월 21일"
    >
      <p>
        타쿠로드(TAKUROAD, 이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요하게 여기며,
        관련 법령을 준수하기 위해 노력합니다. 본 방침은 서비스가 어떤 정보를 수집하고 어떻게
        이용하는지 안내합니다.
      </p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li><strong>계정 정보</strong>: 이메일, 닉네임, 프로필 이미지</li>
        <li><strong>활동 정보</strong>: 후기·게시글·댓글, 방문·저장 기록, 활동 점수</li>
        <li><strong>자동 수집 정보</strong>: 접속 로그, 기기·브라우저 정보, 쿠키</li>
      </ul>

      <h2>2. 개인정보의 이용 목적</h2>
      <ul>
        <li>회원 식별 및 서비스 제공, 커뮤니티·성장 기능 운영</li>
        <li>부정 이용 방지 및 서비스 개선</li>
        <li>문의 응대 및 공지 전달</li>
      </ul>

      <h2>3. 보관 및 파기</h2>
      <p>
        개인정보는 이용 목적이 달성되거나 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라
        일정 기간 보관이 필요한 경우 해당 기간 동안 안전하게 보관합니다.
      </p>

      <h2>4. 광고 및 제3자 서비스</h2>
      <p>
        서비스는 광고 게재를 위해 Google AdSense 등 제3자 광고 서비스를 이용할 수 있습니다. 이 과정에서
        광고 사업자는 쿠키를 사용해 이용자의 관심에 기반한 광고를 제공할 수 있습니다. 이용자는 브라우저
        설정 또는 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">Google 광고 설정</a>을
        통해 맞춤형 광고를 관리할 수 있습니다.
      </p>

      <h2>5. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 본인의 개인정보를 조회·수정하거나 계정 삭제를 요청할 수 있습니다.
      </p>

      <h2>6. 문의</h2>
      <p>
        개인정보 관련 문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a>
      </p>
    </PolicyLayout>
  )
}