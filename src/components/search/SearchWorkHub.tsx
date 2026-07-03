'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getEventsByTag } from '@/services/eventService'
import { getPublicRoutes } from '@/services/routeService'
import type { GlobalSearchResult } from '@/services/globalSearchService'
import { Shop } from '@/types/shop'
import { Icon } from '@/components/tds/Icon'

const AVAILABILITY_LABEL: Record<string, string> = {
  unknown: '확인 안 됨', not_sold: '판매 안 함', sold_out: '품절', few: '소량', normal: '보통', many: '많음',
}
const EVENT_TYPE_LABEL: Record<string, string> = {
  popup: '팝업', event: '이벤트', cafe: '카페', exhibition: '전시', collab: '콜라보', release: '발매',
}
const EVENT_TONE: Record<string, string> = {
  popup: 'linear-gradient(135deg,#C7A3FF,#9B6BFF)', cafe: 'linear-gradient(135deg,#8FE3C6,#43C59E)',
  exhibition: 'linear-gradient(135deg,#FFB38F,#FF7A45)', collab: 'linear-gradient(135deg,#FF9EC4,#FF5692)',
}

interface Props {
  tag: { id: string; name: string; slug: string }
  products: GlobalSearchResult['products']
}

export default function SearchWorkHub({ tag, products }: Props) {
  const [detail, setDetail] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      getTagBySlug(tag.slug),
      getEventsByTag(tag.id, 12),
      getShopsByTag(tag.slug),
      getPublicRoutes({ tag: tag.name }),
    ]).then(([d, ev, sh, rt]) => {
      if (!alive) return
      setDetail(d); setEvents(ev ?? []); setShops(sh ?? []); setRoutes((rt ?? []) as any[]); setLoading(false)
    })
    return () => { alive = false }
  }, [tag.id, tag.slug, tag.name])

  const cover = detail?.cover_url || detail?.banner_image || null

  return (
    <div style={{ padding: '4px 0 48px' }}>
      <div style={cardWrap}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 150, height: 150, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#FF8FB1,#FF5692)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cover ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <WorkIcon size={48} />}
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}><WorkIcon size={14} />대표 작품</span>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>{tag.name}</div>
            {detail?.english_name && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{detail.english_name}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
              {detail?.ip_type && <span style={metaPill}>{detail.ip_type}</span>}
              {detail?.release_year && <span style={metaPill}>{detail.release_year}~</span>}
              {Array.isArray(detail?.genres) && detail.genres.slice(0, 3).map((g: string) => <span key={g} style={metaPill}>{g}</span>)}
            </div>
            {detail?.description && <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: '6px 0 12px', maxWidth: 520 }}>{detail.description}</p>}
            <Link href={`/work/${tag.slug}`} style={primaryBtn}>작품 홈 바로가기 →</Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Link href={`/work/${tag.slug}`} style={chip}><WorkIcon size={16} /> 작품홈</Link>
          <Link href="/map" style={chip}><Icon name="colorpin" size={16} /> 지도에서 보기</Link>
          <a href="#hub-events" style={chip}><Icon name="colorevent" size={16} /> 관련 이벤트</a>
          <a href="#hub-goods" style={chip}><Icon name="colorgift" size={16} /> 관련 굿즈</a>
          <a href="#hub-routes" style={chip}><Icon name="colorroute" size={16} /> 관련 루트</a>
          <a href="#hub-community" style={chip}><Icon name="news" size={16} /> 커뮤니티</a>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <>
          <SecHead id="hub-shops" icon="colorshop" title={`'${tag.name}' 취급 샵`} count={shops.length} />
          {shops.length === 0 ? <Empty text="이 작품을 취급하는 샵이 아직 없어요" /> : (
            <Scroller>
              {shops.map(s => (
                <Link key={s.id} href={`/shop/${s.slug}`} style={cardLink}>
                  <div style={cardImg}>
                    {s.images?.[0] ? <img src={s.images[0]} alt="" style={imgFill} /> : <Icon name="colorshop" size={34} />}
                  </div>
                  <div style={cardName}>{s.name}</div>
                  <div style={cardSub}>{s.region ?? ''}</div>
                  {s.rating_count > 0 && <div style={{ ...cardSub, color: 'var(--yellow)', fontWeight: 800 }}>★ {s.rating_avg.toFixed(1)} ({s.rating_count})</div>}
                </Link>
              ))}
            </Scroller>
          )}

          <SecHead id="hub-goods" icon="colorgift" title="관련 굿즈" count={products.length} />
          {products.length === 0 ? <Empty text="등록된 굿즈 정보가 아직 없어요" /> : (
            <Scroller>
              {products.slice(0, 12).map((p, i) => (
                <Link key={i} href={`/shop/${p.shopSlug}`} style={cardLink}>
                  <div style={{ ...cardImg, background: 'linear-gradient(135deg,#FFE0EC,#FFC2D9)' }}><Icon name="colorgift" size={32} /></div>
                  <div style={cardName}>{p.characterName ? `${p.characterName} · ` : ''}{p.goodsTypeName}</div>
                  <div style={cardSub}>{p.shopName}</div>
                  <div style={{ ...cardSub, fontWeight: 800, color: p.availability === 'many' ? 'var(--green)' : p.availability === 'sold_out' ? 'var(--red)' : 'var(--muted)' }}>{AVAILABILITY_LABEL[p.availability] ?? ''}</div>
                </Link>
              ))}
            </Scroller>
          )}

          <SecHead id="hub-events" icon="colorevent" title={`진행 중인 ${tag.name} 이벤트`} count={events.length} />
          {events.length === 0 ? <Empty text="아직 등록된 이벤트가 없어요" /> : (
            <Scroller>
              {events.map(e => (
                <Link key={e.id} href={e.shopSlug ? `/shop/${e.shopSlug}` : `/work/${tag.slug}`} style={cardLink}>
                  <div style={{ ...cardImg, background: EVENT_TONE[e.type] ?? 'linear-gradient(135deg,#FFB38F,#FF7A45)', color: '#fff', fontWeight: 900, fontSize: 13 }}>
                    {EVENT_TYPE_LABEL[e.type] ?? '이벤트'}
                  </div>
                  <div style={cardName}>{e.title}</div>
                  <div style={cardSub}>{e.shopName ?? ''}</div>
                  {e.endDate && <div style={cardSub}>~ {fmtDate(e.endDate)}</div>}
                </Link>
              ))}
            </Scroller>
          )}

          <SecHead id="hub-routes" icon="colorroute" title={`${tag.name} 테마 루트`} count={routes.length} />
          {routes.length === 0 ? <Empty text="이 작품 관련 루트가 아직 없어요" /> : (
            <Scroller>
              {routes.slice(0, 10).map((r: any) => (
                <Link key={r.id} href={r.share_token ? `/route/${r.share_token}` : '/routes'} style={cardLink}>
                  <div style={{ ...cardImg, background: 'linear-gradient(135deg,#CDE7FF,#9DC7FF)' }}><Icon name="colorroute" size={32} /></div>
                  <div style={cardName}>{r.is_official ? '⭐ ' : ''}{r.title}</div>
                  <div style={{ ...cardSub, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="colorheart" size={13} /> {r.likes ?? 0}</div>
                </Link>
              ))}
            </Scroller>
          )}

          <SecHead id="hub-community" icon="news" title="커뮤니티" />
          <Empty text="커뮤니티는 곧 열려요" />
        </>
      )}
    </div>
  )
}

const cardWrap: React.CSSProperties = { margin: '0 16px 8px', padding: 20, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }
const metaPill: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 9999 }
const primaryBtn: React.CSSProperties = { display: 'inline-block', padding: '9px 18px', borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }
const cardLink: React.CSSProperties = { flexShrink: 0, width: 150, textDecoration: 'none', color: 'inherit' }
const cardImg: React.CSSProperties = { width: 150, height: 110, borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }
const imgFill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }
const cardName: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const cardSub: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function fmtDate(d: string): string {
  try { return new Date(d).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) } catch { return '' }
}
function Scroller({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '12px 16px 4px' }}>{children}</div>
}
function SecHead({ id, icon, title, count }: { id: string; icon: string; title: string; count?: number }) {
  return (
    <div id={id} style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 8, scrollMarginTop: 70 }}>
      <Icon name={icon} size={20} />
      <span style={{ fontSize: 15, fontWeight: 900 }}>{title}</span>
      {count != null && count > 0 && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{count}개</span>}
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div style={{ padding: '14px 16px 4px', fontSize: 13, color: 'var(--muted)' }}>{text}</div>
}

// 작품(북마크) SVG 아이콘 — 라인 아웃라인 + 연한 채움 (컬러 아이콘 톤 통일)
function WorkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M6.5 3.75h11a1.75 1.75 0 0 1 1.75 1.75v14.4a.9.9 0 0 1-1.4.75L12 16.7l-5.85 3.95a.9.9 0 0 1-1.4-.75V5.5A1.75 1.75 0 0 1 6.5 3.75Z" fill="#FF8FB1" stroke="#4A4A55" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M9 8.5h6M9 11.5h4" stroke="#4A4A55" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}





