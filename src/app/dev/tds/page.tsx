'use client'
import { Button, Card, Chip, Badge, SectionHeader } from '@/components/tds'

export default function TdsShowcasePage() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TAKUROAD Design System</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 32px' }}>TDS · Foundation 컴포넌트 쇼케이스</p>

        <Block label="Button">
          <Row>
            <Button variant="primary">체크인 하기</Button>
            <Button variant="secondary">저장</Button>
            <Button variant="outline">길찾기</Button>
            <Button variant="ghost">더보기</Button>
            <Button disabled>비활성</Button>
          </Row>
          <Row>
            <Button size="lg">큰 버튼 (lg)</Button>
            <Button size="md">기본 버튼 (md)</Button>
          </Row>
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" fullWidth>전체 너비 버튼</Button>
          </div>
        </Block>

        <Block label="Chip">
          <Row>
            <Chip tone="coral">하이큐!!</Chip>
            <Chip tone="lavender">블루아카이브</Chip>
            <Chip tone="mint">산리오</Chip>
            <Chip tone="blue">팝업</Chip>
            <Chip tone="yellow">전시</Chip>
            <Chip tone="gray">기타</Chip>
          </Row>
        </Block>

        <Block label="Badge">
          <Row>
            <Badge tone="new">NEW</Badge>
            <Badge tone="hot">HOT</Badge>
            <Badge tone="popular">인기</Badge>
            <Badge tone="recommend">추천</Badge>
          </Row>
        </Block>

        <Block label="SectionHeader">
          <SectionHeader title="이번 주 이벤트" icon="🎉" actionLabel="전체 보기" onAction={() => {}} />
          <SectionHeader title="추천 굿즈샵" icon="🏪" />
          <SectionHeader title="제목만" />
        </Block>

        <Block label="Card">
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>기본 카드</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>넉넉한 내부 여백 · 부드러운 그림자 · 둥근 모서리.</div>
          </Card>
          <Card onClick={() => {}}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 14, background: 'var(--surface2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9C2B6', fontSize: 24 }}>🖼</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>하이큐!! 팝업 스토어</span>
                  <Badge tone="new">NEW</Badge>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>AK 플라자 홍대 · 05.31 ~ 06.02</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Chip tone="coral">하이큐!!</Chip>
                  <Chip tone="blue">팝업</Chip>
                </div>
              </div>
            </div>
          </Card>
        </Block>
      </div>
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', letterSpacing: '.04em', marginBottom: 14 }}>{label.toUpperCase()}</div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>{children}</div>
}
