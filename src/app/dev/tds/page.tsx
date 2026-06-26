'use client'
import { useState } from 'react'
import { Shop } from '@/types/shop'
import { Button, Card, Chip, Badge, SectionHeader, Icon, IconBox, StatusBadge, ShopCard, WorkCard, EventCard, CollectionCard, RouteCard, Taku, EmptyState, CelebrationModal } from '@/components/tds'
import type { WorkCardData } from '@/components/tds/WorkCard'
import type { EventCardData } from '@/components/tds/EventCard'
import type { CollectionCardData } from '@/components/tds/CollectionCard'
import type { RouteCardData } from '@/components/tds/RouteCard'

const ICONS = ['shop','event','collection','route','checkin','work','heart','fire','star','map','search','chevron-right','goods','cafe','news','exhibition','activity','box','clock','people','gift','bell']
const TAKU_POSES = ['default','hi','checkin','map','shopping','gacha','camera','cafe','walk','run','sit','side','back','pay','ui','settings'] as const

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

const shopA = mock({ name: '애니메이트 홍대점', district: '마포구 홍대', cats: ['굿즈샵','전시'], rating_avg: 4.9, rating_count: 320, is_verified: true, hours: WEEK })
const shopB = mock({ name: '코믹존 신촌점', district: '서대문구', cats: ['중고샵','서점'], rating_avg: 4.7, rating_count: 86, hours: WEEK, distance: 1200 })

const works: WorkCardData[] = [
  { id:'1', name:'하이큐!!', affinity:'favorite', state:'in_progress', activities:[{kind:'popup'},{kind:'cafe'}] },
  { id:'2', name:'주술회전', affinity:'favorite', state:'completed', rewatchCount:5, activities:[{kind:'exhibition'},{kind:'goods',count:8}] },
  { id:'3', name:'블루아카이브', affinity:'interest', state:'in_progress', activities:[{kind:'active'},{kind:'shops',count:12}] },
  { id:'4', name:'체인소 맨', affinity:'interest', state:'planned', activities:[], recentlyActive:false },
]

const EVENT_NOW = new Date('2026-06-25T15:00')
const events: EventCardData[] = [
  { id:'e1', type:'exhibition',  title:'주술회전 0 극장판 전시회',       workName:'주술회전',     place:'더현대 서울', startDate:'2026-06-10', endDate:'2026-06-25' },
  { id:'e2', type:'popup',       title:'하이큐!! 페스타 팝업스토어',      workName:'하이큐!!',     place:'홍대 AK&',   startDate:'2026-06-10', endDate:'2026-06-27' },
  { id:'e3', type:'collab_cafe', title:'블루아카이브 × 애니메이트 카페',  workName:'블루아카이브', place:'성수',       startDate:'2026-06-10', endDate:'2026-07-15' },
  { id:'e4', type:'popup',       title:'체인소 맨 시즌2 기념 팝업',       workName:'체인소 맨',    place:'강남',       startDate:'2026-06-25', endDate:'2026-07-10' },
  { id:'e5', type:'exhibition',  title:'산리오 캐릭터 대전 특별전',       workName:'산리오',       place:'코엑스',     startDate:'2026-07-02', endDate:'2026-07-20' },
]

const collections: CollectionCardData[] = [
  { id:'c1', kind:'pilgrimage', title:'하이큐!! 성지순례',     visited:7,  total:12 },
  { id:'c2', kind:'region',     title:'성수동 정복',          visited:11, total:12 },
  { id:'c3', kind:'pilgrimage', title:'주술회전 성지순례',     visited:8,  total:8, justCompleted:true },
  { id:'c4', kind:'pilgrimage', title:'블루아카이브 성지순례', visited:0,  total:10 },
]

const routes: RouteCardData[] = [
  { id:'r1', title:'홍대 굿즈샵 한바퀴', summary:'굿즈샵 3곳 · 카페 2곳', shopCount:5, distanceM:2400, durationMin:45 },
  { id:'r2', title:'성수동 카페 투어',   summary:'카페 위주 · 굿즈샵 1곳', shopCount:5, distanceM:1800, durationMin:28, visited:3 },
  { id:'r3', title:'강남 피규어 성지',   summary:'굿즈샵 4곳 · 중고샵 2곳', shopCount:6, distanceM:3100, durationMin:42, visited:6, completedAt:'2026.07.15' },
]

export default function TdsShowcasePage() {
  const [celeb, setCeleb] = useState<null | 'checkin' | 'collection' | 'route'>(null)
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TAKUROAD Design System</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 32px' }}>TDS 쇼케이스</p>

        <Block label="TAKU 마스코트 (16종)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 }}>
            {TAKU_POSES.map((p) => (
              <div key={p} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 8px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ height: 96, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><Taku pose={p} size={88} /></div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{p}</div>
              </div>
            ))}
          </div>
        </Block>

        <Block label="EmptyState (TAKU)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <EmptyState pose="sit" title="조건에 맞는 샵이 없어요" description="필터를 바꿔서 다시 찾아볼까요?" />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <EmptyState pose="default" title="저장한 샵이 없어요" description="마음에 드는 샵을 저장해보세요" action={{ label: '샵 둘러보기', onClick: () => {} }} />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <EmptyState pose="hi" title="타쿠로드에 오신 걸 환영해요" description="좋아하는 작품부터 찾아볼까요?" action={{ label: '작품 찾기', onClick: () => {} }} />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <EmptyState pose="map" title="페이지를 찾을 수 없어요" description="길을 잃었나 봐요. 홈으로 돌아갈까요?" action={{ label: '홈으로', onClick: () => {} }} secondaryAction={{ label: '뒤로', onClick: () => {} }} />
            </div>
          </div>
        </Block>

        <Block label="CelebrationModal (도장 연출)">
          <Row>
            <Button variant="primary" onClick={() => setCeleb('collection')}>컬렉션 달성</Button>
            <Button variant="secondary" onClick={() => setCeleb('route')}>루트 완주</Button>
            <Button variant="outline" onClick={() => setCeleb('checkin')}>체크인</Button>
          </Row>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>버튼을 누르면 모달이 떠요. 딤 클릭/ESC/버튼으로 닫힘.</p>
        </Block>

        {celeb === 'collection' && (
          <CelebrationModal open variant="collection" title="주술회전 성지순례" description="8곳 전부 방문" subDescription="2026.07.15" stampKind="pilgrimage" canMakeMemorial onMakeMemorial={async () => { await new Promise(r => setTimeout(r, 600)) }} onClose={() => setCeleb(null)} />
        )}
        {celeb === 'route' && (
          <CelebrationModal open variant="route" title="홍대 굿즈샵 한바퀴" description="5곳 전부 완주" subDescription="2026.07.15" stampKind="route" canMakeMemorial onMakeMemorial={async () => { await new Promise(r => setTimeout(r, 600)) }} onClose={() => setCeleb(null)} />
        )}
        {celeb === 'checkin' && (
          <CelebrationModal open variant="checkin" title="애니메이트 홍대점" description="체크인 완료" onClose={() => setCeleb(null)} />
        )}

        <Block label="EventCard (핵심 카드)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(206px,1fr))', gap: 14 }}>
            {events.map((e) => <EventCard key={e.id} event={e} now={EVENT_NOW} onClick={() => {}} />)}
          </div>
        </Block>

        <Block label="RouteCard (코스 · 완주 도장)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(248px,1fr))', gap: 14 }}>
            {routes.map((r) => <RouteCard key={r.id} route={r} onStart={() => {}} onClick={() => {}} />)}
          </div>
        </Block>

        <Block label="CollectionCard (진행도 · 도장)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {collections.map((c) => <CollectionCard key={c.id} collection={c} onClick={() => {}} />)}
          </div>
        </Block>

        <Block label="WorkCard">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            {works.map((w) => <WorkCard key={w.id} work={w} onClick={() => {}} />)}
          </div>
        </Block>

        <Block label="ShopCard">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            <ShopCard shop={shopA} badge="recommend" onClick={() => {}} onToggleSave={() => {}} />
            <ShopCard shop={shopB} meta="distance" onClick={() => {}} onToggleSave={() => {}} />
          </div>
        </Block>

        <Block label="StatusBadge (6종)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatusBadge shop={mock({ hours: WEEK })} now={MON('14:00')} />
            <StatusBadge shop={mock({ hours: WEEK })} now={MON('21:30')} />
            <StatusBadge shop={mock({ hours: WEEK })} now={MON('09:00')} />
            <StatusBadge shop={mock({ hours: WEEK })} now={MON('23:00')} />
            <StatusBadge shop={mock({ status: 'temporary_closed', hours: WEEK })} now={MON('14:00')} />
            <StatusBadge shop={mock({ status: 'closed', hours: WEEK })} now={MON('14:00')} />
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

        <Block label="SectionHeader">
          <SectionHeader title="이번 주 이벤트" icon={<Icon name="event" size={19} />} tone="coral" actionLabel="전체 보기" onAction={() => {}} />
          <SectionHeader title="추천 굿즈샵" icon={<Icon name="shop" size={19} />} tone="mint" actionLabel="전체 보기" onAction={() => {}} />
        </Block>

        <Block label="Button / Chip / Badge">
          <Row>
            <Button variant="primary">체크인 하기</Button>
            <Button variant="secondary">저장</Button>
            <Button variant="outline">길찾기</Button>
          </Row>
          <Row>
            <Chip tone="coral">하이큐!!</Chip>
            <Chip tone="lavender">블루아카이브</Chip>
            <Chip tone="mint">산리오</Chip>
          </Row>
          <Row>
            <Badge tone="new">NEW</Badge>
            <Badge tone="hot">HOT</Badge>
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



