'use client'
import { Shop } from '@/types/shop'
import { Button, Card, Chip, Badge, SectionHeader, Icon, IconBox, StatusBadge, ShopCard } from '@/components/tds'

const ICONS = ['shop','event','collection','route','checkin','work','heart','fire','star','map','search','chevron-right']

const mock = (p: Partial<Shop>): Shop => ({
  id: '', slug: '', name: '', description: null, addr: null, country: 'KR',
  region: null, city: null, district: null, lat: null, lng: null, google_place_id: null,
  cat: '굿즈샵', cats: [], images: [], hours: null, parking: null, parking_note: null,
  shop_link: null, floor_info: null, start_date: null, end_date: null, event_info: null,
  rating_avg: 0, rating_count: 0, visit_count: 0, bookmark_count: 0,
  is_verified: false, is_claimed: false, status: 'active', added_by: null, owner_id: null,
  created_at: '', updated_at: '', ...p,
} as Shop)

const WEEK = { mon:{open:'10:00',close:'22:00'}, tue:{open:'10:00',close:'22:00'}, wed:{open:'10:00',close:'22:00'}, thu:{open:'10:00',close:'22:00'}, fri:{open:'10:00',close:'22:00'}, sat:{open:'10:00',close:'22:00'}, sun:{open:'10:00',close:'22:00'} } as Shop['hours']
const MON = (hhmm: string) => new Date(`2026-06-22T${hhmm}:00`)

const statusDemos: { now: Date; shop: Shop }[] = [
  { now: MON('14:00'), shop: mock({ hours: WEEK }) },
  { now: MON('21:30'), shop: mock({ hours: WEEK }) },
  { now: MON('09:00'), shop: mock({ hours: WEEK }) },
  { now: MON('23:00'), shop: mock({ hours: WEEK }) },
  { now: MON('14:00'), shop: mock({ status: 'temporary_closed', hours: WEEK }) },
  { now: MON('14:00'), shop: mock({ status: 'closed', hours: WEEK }) },
]

const shopA = mock({ name: '애니메이트 홍대점', district: '마포구 홍대', cats: ['굿즈샵','전시'], rating_avg: 4.9, rating_count: 320, is_verified: true, hours: WEEK })
const shopB = mock({ name: '코믹존 신촌점', district: '서대문구', cats: ['중고샵','서점'], rating_avg: 4.7, rating_count: 86, hours: WEEK, distance: 1200 })
const shopC = mock({ name: '가챠샵 강남', district: '강남구', cats: ['가챠/쿠지'], rating_avg: 0, rating_count: 0, status: 'temporary_closed' })

export default function TdsShowcasePage() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TAKUROAD Design System</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 32px' }}>TDS 쇼케이스</p>

        <Block label="ShopCard">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            <ShopCard shop={shopA} badge="recommend" onClick={() => {}} onToggleSave={() => {}} />
            <ShopCard shop={shopB} meta="distance" onClick={() => {}} onToggleSave={() => {}} />
            <ShopCard shop={shopC} onClick={() => {}} onToggleSave={() => {}} />
          </div>
        </Block>

        <Block label="StatusBadge (6종)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusDemos.map((d, i) => (
              <StatusBadge key={i} shop={d.shop} now={d.now} />
            ))}
          </div>
        </Block>

        <Block label="Icon (차콜 단색)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 10 }}>
            {ICONS.map((n) => (
              <div key={n} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 8px 11px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name={n} size={30} /></div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 7 }}>{n}</div>
              </div>
            ))}
          </div>
        </Block>

        <Block label="IconBox (파스텔)">
          <Row>
            <IconBox name="event" tone="coral" />
            <IconBox name="shop" tone="mint" />
            <IconBox name="collection" tone="yellow" />
            <IconBox name="work" tone="lavender" />
            <IconBox name="map" tone="blue" />
            <IconBox name="search" tone="gray" />
          </Row>
        </Block>

        <Block label="SectionHeader">
          <SectionHeader title="이번 주 이벤트" icon={<Icon name="event" size={19} />} tone="coral" actionLabel="전체 보기" onAction={() => {}} />
          <SectionHeader title="추천 굿즈샵" icon={<Icon name="shop" size={19} />} tone="mint" actionLabel="전체 보기" onAction={() => {}} />
        </Block>

        <Block label="Button">
          <Row>
            <Button variant="primary">체크인 하기</Button>
            <Button variant="secondary">저장</Button>
            <Button variant="outline">길찾기</Button>
            <Button variant="ghost">더보기</Button>
            <Button disabled>비활성</Button>
          </Row>
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
