import PolicyLayout from '@/components/policy/PolicyLayout'

export const metadata = { title: '면책사항 · 타쿠로드' }

export default function Page() {
  return (
    <PolicyLayout title="면책사항" description="매장 정보의 정확성에 대한 안내입니다.">
      <div className="pending">
        <p>타쿠로드의 영업시간·이벤트 일정·재고 등 매장 정보는 실제와 다를 수 있어요. 방문 전 각 매장의 공식 채널을 통해 꼭 확인해 주세요. 서비스는 정보 변경으로 인한 손해에 책임을 지지 않아요.</p>
        <p style={{ marginTop: 12 }}>문의: <a href="mailto:ttakuroad@gmail.com">ttakuroad@gmail.com</a></p>
      </div>
    </PolicyLayout>
  )
}