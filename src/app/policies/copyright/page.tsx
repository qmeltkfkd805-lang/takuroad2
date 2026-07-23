import Link from 'next/link'
import PolicyLayout from '@/components/policy/PolicyLayout'
import ContactLinks from '@/components/common/ContactLinks'

export const metadata = { title: '저작권 안내 · 타쿠로드' }

const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: '32px 0 10px' }
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.85, margin: '0 0 10px' }
const ul: React.CSSProperties = { fontSize: 15, lineHeight: 1.85, paddingLeft: 20, margin: '0 0 10px' }

export default function Page() {
  return (
    <PolicyLayout
      title="저작권 안내"
      description="타쿠로드가 저작권을 어떻게 다루는지, 권리자와 이용자가 알아두실 내용을 정리했습니다."
      updated="2026년 7월 23일"
    >
      <h2 style={h2}>1. 타쿠로드는 어떤 서비스인가요</h2>
      <p style={p}>
        타쿠로드는 애니메이션·게임·캐릭터 등 좋아하는 작품과 관련된 <strong>작품 정보, 굿즈 매장 정보, 이벤트 정보</strong>를
        한곳에서 찾아볼 수 있도록 돕는 커뮤니티 기반 정보 서비스입니다.
        이용자들이 직접 정보를 등록하고 공유하며 함께 채워가는 방식으로 운영됩니다.
      </p>
      <p style={p}>
        타쿠로드는 <strong>공식 애니메이션 서비스나 권리자가 운영하는 서비스가 아닙니다.</strong>
        작품을 감상할 수 있는 서비스가 아니며, 굿즈를 직접 판매하지도 않습니다.
      </p>

      <h2 style={h2}>2. 권리의 귀속</h2>
      <p style={p}>
        타쿠로드에 표시되는 작품명, 캐릭터명, 로고, 이미지 등 모든 지식재산권은 해당 저작권자와 권리자에게 있습니다.
        타쿠로드는 이러한 자료를 <strong>정보 제공과 검색 편의, 커뮤니티 운영을 위한 목적</strong>으로만 사용하며,
        권리자의 권리를 대신하거나 취득하지 않습니다.
      </p>

      <h2 style={h2}>3. 이용자가 올린 콘텐츠</h2>
      <p style={p}>
        후기, 사진, 게시글 등 이용자가 올린 콘텐츠의 권리와 책임은 이를 작성한 이용자 본인에게 있습니다.
        타인의 저작물을 권리자의 허락 없이 올리는 행위는 금지되며, 이로 인해 발생하는 문제는 작성자가 책임집니다.
      </p>
      <p style={p}>
        권리 침해가 확인된 경우 타쿠로드는 해당 콘텐츠에 대해 <strong>수정, 비공개 처리, 삭제 등 필요한 조치</strong>를 할 수 있습니다.
        반복적인 침해가 확인되면 이용을 제한할 수 있습니다.
      </p>

      <h2 style={h2}>4. 권리 침해 신고</h2>
      <p style={p}>
        타쿠로드에 게시된 내용이 권리를 침해한다고 판단되시면{' '}
        <Link href="/support/contact" style={{ color: 'var(--accent)', fontWeight: 700 }}>문의하기</Link> 페이지에서{' '}
        문의 유형을 <strong>권리자 요청</strong>으로 선택해 접수해 주세요.
        접수된 내용은 확인 후 신속하게 조치하고, 처리 결과를 알려드립니다.
      </p>
      <p style={p}>접수하실 때 다음 내용을 함께 적어주시면 처리가 빨라집니다.</p>
      <ul style={ul}>
        <li>침해가 발생한 페이지 주소</li>
        <li>침해받은 저작물이나 권리에 대한 설명</li>
        <li><strong>권리 관계를 확인할 수 있는 자료</strong> (권리자 증명, 위임 관계 등)</li>
        <li>연락 가능한 이메일 주소</li>
      </ul>

      <h2 style={h2}>5. 정보의 정확성과 면책</h2>
      <p style={p}>
        타쿠로드의 정보는 이용자 제보와 공개된 자료를 바탕으로 하며,
        <strong> 매장 정보, 작품 정보, 가격, 영업시간, 이벤트 일정, 재고 상황</strong> 등은 예고 없이 달라질 수 있습니다.
        타쿠로드는 정확한 정보를 유지하기 위해 노력하지만 모든 내용의 정확성을 보장하지는 않습니다.
      </p>
      <p style={p}>
        방문이나 구매를 계획하고 계시다면 <strong>가기 전에 매장이나 주최 측의 공식 채널에서 한 번 더 확인</strong>해 주세요.
      </p>

      <h2 style={h2}>6. 공식 제휴 관계에 대한 안내</h2>
      <p style={p}>
        타쿠로드에 특정 작품, 브랜드, 기업, 매장의 정보가 실려 있다는 사실이
        그들과의 <strong>공식적인 제휴나 후원 관계를 의미하지는 않습니다.</strong>
        별도의 공식 제휴가 명시되어 있지 않은 경우, 타쿠로드는 각 권리자와 독립적으로 운영되는 서비스입니다.
      </p>

      <h2 style={h2}>문의</h2>
      <p style={p}>
        권리 침해 신고는 <Link href="/support/contact" style={{ color: 'var(--accent)', fontWeight: 700 }}>문의하기</Link>에서{' '}
        <strong>권리자 요청</strong>으로 접수해 주세요. 그 밖의 저작권 문의도 같은 곳에서 받고 있습니다.
      </p>
      <ContactLinks label={null} />
    </PolicyLayout>
  )
}