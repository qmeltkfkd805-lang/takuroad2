'use client'

import { hostOf } from '@/lib/utils/linkUrl'
import MakerLinkIcon from './MakerLinkIcon'
import { DukmarkSite, DukmarkSource } from '@/types/community-post'

/* 덕마크 글 상세 조각 (시안 2026-10-18)
   - SiteCard:   소개하는 사이트 한 곳 — 아이콘·이름·한 줄 설명·주소, [사이트 열기], 제작자 + 제작자 링크
   - SiteMiniList: PC 오른쪽 '이 글의 사이트' — 아이콘·이름·주소·↗
   - SourcesBox: 참고한 출처
   아이콘 = 링크 미리보기 대표 이미지(있으면), 없으면 이름 첫 글자 */

export type SiteIcons = Record<string, string | null>   // 주소 → 미리보기 이미지

const siteName = (s: DukmarkSite) => s.name?.trim() || hostOf(s.url) || s.url

function SiteIcon({ site, icons, size }: { site: DukmarkSite; icons: SiteIcons; size: number }) {
  const img = icons[site.url]
  const r = Math.round(size * 0.28)
  if (img) return <img src={img} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flexShrink: 0, background: 'var(--surface2)', border: '1px solid var(--border)' }} />
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: r, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l, rgba(255,86,146,.12))', color: 'var(--accent)', fontWeight: 900, fontSize: Math.round(size * 0.42) }}>
      {siteName(site).slice(0, 1).toUpperCase()}
    </span>
  )
}

const openNew = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

export function SiteCard({ site, icons, desktop }: { site: DukmarkSite; icons: SiteIcons; desktop: boolean }) {
  const openBtn = (
    <button type="button" onClick={() => openNew(site.url)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: desktop ? 190 : '100%', flexShrink: 0, padding: desktop ? '11px 14px' : '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
      사이트 열기 <ArrowIcon />
    </button>
  )
  const hasMaker = !!site.maker || site.makerLinks.length > 0
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: desktop ? 'center' : 'flex-start', padding: '14px 14px 12px' }}>
        <SiteIcon site={site} icons={icons} size={desktop ? 52 : 48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteName(site)}</div>
          {site.desc && <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2, lineHeight: 1.45, wordBreak: 'keep-all' }}>{site.desc}</div>}
          {site.name?.trim() && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{hostOf(site.url)}</div>}
        </div>
        {desktop && openBtn}
      </div>
      {!desktop && <div style={{ padding: '0 14px 12px' }}>{openBtn}</div>}
      {hasMaker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: desktop ? '0 0 128px' : '1 1 auto' }}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>제작자</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.maker || '알 수 없음'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {site.makerLinks.map(l => (
              <button key={l.url} type="button" onClick={() => openNew(l.url)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                <MakerLinkIcon url={l.url} />{l.label} <ArrowIcon size={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SiteMiniList({ sites, icons }: { sites: DukmarkSite[]; icons: SiteIcons }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sites.map((s, i) => (
        <button key={s.url} type="button" onClick={() => openNew(s.url)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 4px', border: 'none', borderTop: i ? '1px solid var(--border)' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--text)' }}>
          <SiteIcon site={s} icons={icons} size={38} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteName(s)}</span>
            {s.name?.trim() && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hostOf(s.url)}</span>}
          </span>
          <ArrowIcon />
        </button>
      ))}
    </div>
  )
}

export function SourcesBox({ sources, desktop }: { sources: DukmarkSource[]; desktop: boolean }) {
  return (
    <div style={{ display: 'flex', gap: desktop ? 28 : 12, alignItems: 'flex-start', flexDirection: desktop ? 'row' : 'row', padding: '14px 16px', borderRadius: 12, background: 'var(--surface2)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 900, flexShrink: 0, whiteSpace: 'nowrap' }}><BookIcon />참고한 출처</span>
      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
        {sources.map((s, i) => (
          <li key={i} style={{ wordBreak: 'break-word' }}>
            {s.url
              ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>{s.label} ↗</a>
              : <span style={{ color: 'var(--text)' }}>{s.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SectionTitle({ icon, children }: { icon: 'link' | 'doc'; children: React.ReactNode }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 900, margin: '0 0 12px', color: 'var(--text)' }}>
      {icon === 'link' ? <LinkIcon /> : <DocIcon />}{children}
    </h2>
  )
}

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function ArrowIcon({ size = 14 }: { size?: number }) { return <svg {...svg} width={size} height={size} style={{ flexShrink: 0 }}><path d="M7 17 17 7M8 7h9v9" /></svg> }
function LinkIcon() { return <svg {...svg} width={20} height={20} style={{ flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg> }
function DocIcon() { return <svg {...svg} width={20} height={20} style={{ flexShrink: 0 }}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg> }
function BookIcon() { return <svg {...svg} width={18} height={18} style={{ flexShrink: 0 }}><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11v17H4.5A2.5 2.5 0 0 0 2 22.5zM22 5.5A2.5 2.5 0 0 0 19.5 3H13v17h6.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg> }
