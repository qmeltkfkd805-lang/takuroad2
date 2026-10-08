'use client'
/* 샵 상세 '기본 정보' — 정보별 가로 행.
   영업시간 / 주소·장소 / 전화 / 주차 / 공식 채널 / 사장님 인증
   · PC(ShopDetailPageDesktop)와 모바일(ShopDetailPage)이 같이 쓴다.
   · 영업 상태 계산은 기존 getTodayStatus 결과(todayStatus)를 그대로 받아 표시만 한다.
   · 저장된 값만 보여준다 — 없는 정보는 '정보 없음'으로 두고, 링크가 하나도 없으면 공식 채널 행은 그리지 않는다. */
import { useState, useEffect } from 'react'
import { Shop } from '@/types/shop'
import { formatBusinessHours, holidayRuleLabel } from '@/lib/utils/date'
import { monthlyOffLabel } from '@/lib/utils/monthlyOff'
import { parseParkingRows } from '@/lib/utils/parkingNote'
import HolidayHoursRows from './HolidayHoursRows'
import VerifyRequestButton from './VerifyRequestButton'
import ReportIssueButton from './ReportIssueButton'
import styles from './ShopBasicInfo.module.css'

interface Props {
  shop: Shop
  todayStatus: { isOpen: boolean; label: string; todayHours: string | null }
  /** 모바일은 이름 아래 영업시간 카드가 따로 있어 이 행을 숨긴다 */
  showHours?: boolean
  /** 제목줄 오른쪽 '정보 수정 제안' (기존 정보 신고 기능을 연다) */
  showSuggest?: boolean
}

/* ── 공식 채널: 링크 주소로 종류 판별 (기존 상세 페이지와 같은 규칙) ── */
type Channel = { kind: string; url: string }
function detectChannel(url: string): Channel {
  const u = url.toLowerCase()
  if (u.includes('threads.net') || u.includes('threads.com')) return { kind: 'threads', url }
  if (u.includes('instagram.com')) return { kind: 'instagram', url }
  if (u.includes('x.com') || u.includes('twitter.com')) return { kind: 'x', url }
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { kind: 'youtube', url }
  if (u.includes('kakao')) return { kind: 'kakao', url }
  if (u.includes('cafe.naver')) return { kind: 'navercafe', url }
  if (u.includes('blog.naver')) return { kind: 'naverblog', url }
  if (u.includes('naver')) return { kind: 'naver', url }
  return { kind: 'globe', url }
}
const CHANNEL_NAME: Record<string, string> = {
  instagram: '인스타그램', x: 'X', threads: '스레드', youtube: '유튜브',
  kakao: '카카오톡', navercafe: '네이버 카페', naverblog: '네이버 블로그', naver: '네이버', globe: '홈페이지',
}
const CHANNEL_ICON_FILES: Record<string, string[]> = {
  // 실제 파일 이름(public/icons/instargram.png, X.png)을 먼저 — 예전 순서는 매번 없는 파일을 먼저 불러 404 가 났다
  instagram: ['instargram', 'instagram'],
  threads: ['threads'],
  x: ['X', 'x'],
  kakao: ['kakao', 'kakaotalk'],
  youtube: ['youtube'],
  naver: ['naver'],
  navercafe: ['navercafe', 'naver'],
  naverblog: ['naverblog', 'naver'],
  globe: ['homepage', 'globe'],
}
function ChannelIcon({ kind }: { kind: string }) {
  const files = CHANNEL_ICON_FILES[kind] ?? [kind]
  const [idx, setIdx] = useState(0)
  if (idx < files.length) {
    return <img src={`/icons/${files[idx]}.png`} width={18} height={18} alt="" onError={() => setIdx(i => i + 1)} style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
  }
  return <Svg><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 2.6 15 0 18M12 3c-2.6 2.7-2.6 15 0 18" /></Svg>
}

/* 예약 사이트 이름 — 주소로 알아본다 (모르면 '예약 페이지') */
function reservationSite(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('booking.naver') || u.includes('naver.me') || u.includes('m.place.naver') || u.includes('map.naver')) return '네이버 예약'
  if (u.includes('catchtable')) return '캐치테이블'
  if (u.includes('tabling')) return '테이블링'
  if (u.includes('kakao')) return '카카오 예약'
  if (u.includes('instagram.com')) return '인스타그램 DM 예약'
  if (u.includes('forms.gle') || u.includes('docs.google.com/forms')) return '구글폼 예약'
  return '예약 페이지'
}

export default function ShopBasicInfo({ shop, todayStatus, showHours = true, showSuggest = true }: Props) {
  const color = 'var(--accent)'

  // ── 영업시간 (표시만 — 계산은 기존 함수) ──
  const hoursFormatted = formatBusinessHours(shop.hours)
  const hasHours = hoursFormatted.length > 0
  const [hoursOpen, setHoursOpen] = useState(false)
  const holidayLabel = holidayRuleLabel(shop.hours)            // "공휴일 휴무" / "공휴일 10:30 ~ 22:00"
  const yearRound = (shop.hours as any)?.yearRound === true    // 저장된 '연중무휴' 표시
  const monthlyOff = monthlyOffLabel(shop.hours)               // "매월 둘째·넷째 일요일 휴무"
  const statusClosed = shop.status === 'closed' || shop.status === 'temporary_closed'
  const noHoursInfo = !hasHours && !todayStatus.todayHours

  // ── 공식 채널 (홈페이지 + SNS) — 등록된 링크만 ──
  const links = (shop.sns_links?.length ? shop.sns_links : (shop.shop_link ? [shop.shop_link] : []))
    .map(s => (s ?? '').trim()).filter(Boolean)
  const channels = Array.from(new Set(links)).map(detectChannel)
  // 홈페이지를 앞에
  channels.sort((a, b) => (a.kind === 'globe' ? 0 : 1) - (b.kind === 'globe' ? 0 : 1))

  // ── 주소 복사 ──
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t) }, [copied])
  async function copyAddr() {
    if (!shop.addr) return
    try { await navigator.clipboard.writeText(shop.addr); setCopied(true); return } catch { /* 아래 방식으로 */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = shop.addr; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(true)
    } catch { /* 복사 불가 환경 */ }
  }

  const subNotes: { text: string; warn: boolean }[] = []
  if (yearRound) subNotes.push({ text: '연중무휴', warn: false })
  if (monthlyOff) subNotes.push({ text: monthlyOff, warn: true })
  if (holidayLabel) subNotes.push({ text: holidayLabel, warn: holidayLabel.includes('휴무') })

  const statusColor = todayStatus.isOpen ? '#14b8a0' : '#ef5a5a'
  const phone = (shop.phone ?? '').trim()

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>기본 정보</h2>
        {showSuggest && (
          <ReportIssueButton
            shopId={shop.id}
            variant="menu"
            label="정보 수정 제안"
            icon={<Svg size={15}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>}
            style={{}}
            className={styles.suggest}
          />
        )}
      </div>

      <div className={styles.rows}>
        {/* 1. 영업시간 */}
        {showHours && (
          <div className={`${styles.row} ${styles.rowHours}`}>
            <span className={styles.icon} aria-hidden><Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></span>
            {statusClosed ? (
              <>
                <span className={styles.label}>영업 상태</span>
                <div className={styles.body}>
                  <span className={styles.strong} style={{ color: shop.status === 'closed' ? '#ef5a5a' : '#3e8fc9' }}>
                    {shop.status === 'closed' ? '폐점' : '임시 휴업'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className={styles.label} style={todayStatus.todayHours ? { color: statusColor, fontWeight: 800 } : undefined}>
                  {todayStatus.todayHours ? todayStatus.label : '영업시간'}
                </span>
                <div className={styles.body}>
                  <button
                    type="button"
                    className={styles.hoursBtn}
                    onClick={() => hasHours && setHoursOpen(o => !o)}
                    disabled={!hasHours}
                    aria-expanded={hasHours ? hoursOpen : undefined}
                  >
                    {todayStatus.todayHours
                      ? <span className={styles.today}>{todayStatus.todayHours}</span>
                      : <span className={styles.today} style={noHoursInfo ? { color: 'var(--muted)', fontWeight: 600 } : { color: statusColor }}>{todayStatus.label}</span>}
                    {subNotes.length > 0 && (
                      <span className={styles.sub} style={{ display: 'block' }}>
                        {subNotes.map((n, i) => (
                          <span key={i} className={n.warn ? styles.subWarn : undefined}>{i > 0 && ' · '}{n.text}</span>
                        ))}
                      </span>
                    )}
                  </button>
                  {hoursOpen && hasHours && (
                    <div className={styles.week}>
                      {hoursFormatted.map(h => (
                        <div key={h.day} className={styles.weekRow}>
                          <span className={styles.weekDay}>{h.label}</span>
                          <span style={{ color: h.isOpen ? 'var(--text)' : 'var(--muted)', fontWeight: h.isOpen ? 600 : 400 }}>{h.hours}</span>
                        </div>
                      ))}
                      <HolidayHoursRows hours={shop.hours} />
                    </div>
                  )}
                </div>
                {hasHours && (
                  <div className={styles.action}>
                    <button type="button" className={styles.chevBtn} onClick={() => setHoursOpen(o => !o)}
                      aria-expanded={hoursOpen} aria-label={hoursOpen ? '요일별 영업시간 접기' : '요일별 영업시간 펼치기'}>
                      <Svg size={18} className={`${styles.chev} ${hoursOpen ? styles.chevOpen : ''}`}><path d="M6 9l6 6 6-6" /></Svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 2. 주소 · 장소 */}
        <div className={styles.row}>
          <span className={styles.icon} aria-hidden><Svg><path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" /><path d="M17.7 16.7 12 22l-5.7-5.3a8 8 0 1 1 11.4 0z" /></Svg></span>
          <span className={styles.label}>주소</span>
          <div className={styles.body}>
            {shop.addr
              ? <>{shop.addr}{shop.floor_info && <>{' '}<span className={styles.floor}>{shop.floor_info}</span></>}</>
              : <span className={styles.muted}>정보 없음</span>}
            {shop.place_slug && shop.place_name && (
              <div>
                <a href={`/place/${shop.place_slug}`} className={styles.place}>
                  <Svg><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-4h6v4" /><path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></Svg>
                  {shop.place_name}
                  <Svg size={13}><path d="m9 18 6-6-6-6" /></Svg>
                </a>
              </div>
            )}
          </div>
          {shop.addr && (
            <div className={styles.action}>
              <button type="button" className={`${styles.textBtn} ${copied ? styles.copied : ''}`} onClick={copyAddr} aria-label="주소 복사">
                {copied
                  ? <Svg><path d="m5 12 5 5L20 6" /></Svg>
                  : <Svg><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Svg>}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          )}
        </div>

        {/* 3. 전화 */}
        <div className={styles.row}>
          <span className={styles.icon} aria-hidden><Svg><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z" /></Svg></span>
          <span className={styles.label}>전화</span>
          <div className={styles.body}>
            {phone ? <span className={styles.strong}>{phone}</span> : <span className={styles.muted}>정보 없음</span>}
          </div>
          {phone && (
            <div className={styles.action}>
              <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className={styles.ghostBtn}>
                <Svg><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z" /></Svg>
                전화하기
              </a>
            </div>
          )}
        </div>

        {/* 예약 — 예약 링크나 '예약 필수'가 있을 때만 */}
        {(shop.reservation_url || shop.reservation_required) && (
          <div className={styles.row}>
            <span className={styles.icon} aria-hidden><Svg><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /><path d="m9 15 2 2 4-4" /></Svg></span>
            <span className={styles.label}>
              예약{shop.reservation_required && <span className={styles.reserveReq}>예약 필수</span>}
            </span>
            <div className={styles.body}>
              {shop.reservation_url
                ? <span className={styles.strong}>{reservationSite(shop.reservation_url)}</span>
                : <span>방문 전에 예약이 필요해요</span>}
            </div>
            {shop.reservation_url && (
              <div className={styles.action}>
                <a href={shop.reservation_url} target="_blank" rel="noopener noreferrer" className={styles.primaryBtn}>
                  예약하기
                  <svg className={styles.ext} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: '#fff' }}><path d="M7 17 17 7M8 7h9v9" /></svg>
                </a>
              </div>
            )}
          </div>
        )}

        {/* 4. 주차 — 가능 여부 + 저장된 안내 문구 그대로 */}
        <div className={styles.row}>
          <span className={styles.icon} aria-hidden><Svg><circle cx="12" cy="12" r="9" /><path d="M10 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3" /></Svg></span>
          <span className={styles.label}>주차</span>
          <div className={styles.body}>
            {shop.parking === null
              ? (!shop.parking_note && <span className={styles.muted}>정보 없음</span>)
              : <span className={styles.strong}>{shop.parking ? '주차 가능' : '주차 불가'}</span>}
            {shop.parking_note && <ParkingNote note={shop.parking_note} />}
          </div>
        </div>

        {/* 5. 공식 채널 — 링크가 하나도 없으면 행을 그리지 않는다 */}
        {channels.length > 0 && (
          <div className={styles.row}>
            <span className={styles.icon} aria-hidden><Svg><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg></span>
            <span className={styles.label}>공식 채널</span>
            <div className={styles.body}>
              <div className={styles.channels}>
                {channels.map((c, i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className={styles.channel} title={c.url}>
                    <ChannelIcon kind={c.kind} />
                    <span className={styles.channelName}>{CHANNEL_NAME[c.kind] ?? '링크'}</span>
                    <svg className={styles.ext} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. 사장님 인증 — 기존 조건 그대로 (인증 안 된 샵 + 로그인한 사람에게만, 신청 상태별 표시) */}
      {!shop.is_claimed && (
        <VerifyRequestButton shopId={shop.id} shopName={shop.name} slug={shop.slug} accentColor={color} variant="row" />
      )}
    </section>
  )
}

// 주차 메모 — 사장님이 입력한 문구 그대로. 줄바꿈이 있으면 줄바꿈대로, "조건 : 값" 여러 개면 표로
function ParkingNote({ note }: { note: string }) {
  if (/\r?\n/.test(note)) return <div className={styles.note} style={{ color: 'var(--text)' }}>{note}</div>
  const rows = parseParkingRows(note)
  if (rows.length <= 1) return <div className={styles.note}>{note}</div>
  return (
    <ul className={styles.noteList}>
      {rows.map((r, i) => (
        <li key={i} className={styles.noteItem}>
          {r.label != null && <span className={styles.noteKey}>{r.label}</span>}
          <span className={styles.noteVal}>{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

function Svg({ size = 19, className, children }: { size?: number; className?: string; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} style={{ display: 'block', flexShrink: 0 }}>
      {children}
    </svg>
  )
}
