'use client'

import { UserAvatar } from '@/components/cosmetic/UserFace'
import AppIcon from '@/components/tds/AppIcon'
import { dukmarkCover } from '@/lib/utils/dukmark'
import { DukmarkCard, DUKMARK_USE_LABEL } from '@/types/community-post'

/* 덕마크 카드 한 장 (시안 2026-10-18)
   - wide:  모바일 덕마크 탭 — 큰 대표 이미지, 제목, '사이트 N곳 · 작성자', 핑크 태그 2개 + +N, ♥·댓글
   - grid:  PC 덕마크 탭·홈 추천 — 대표 이미지, 제목, 회색 알약(사이트 N곳·작품), 작성자 · ♥ · 저장
   카드 전체를 누르면 글로, 북마크 버튼은 저장/해제 (저장 = 마이페이지 저장함과 같은 saved_posts) */

interface Props {
  card: DukmarkCard
  variant: 'wide' | 'grid'
  workNames: string[]          // 글의 작품 이름들 (없으면 '전체 공통')
  saved: boolean
  onToggleSave: () => void
  onOpen: () => void
}

export default function DukmarkCardView({ card, variant, workNames, saved, onToggleSave, onOpen }: Props) {
  const { post, dukmark } = card
  const cover = dukmarkCover(post, dukmark)
  const siteCount = dukmark.siteUrls.length
  const author = post.author?.nickname ?? '익명'
  const tags = [...(workNames.length ? workNames : ['전체 공통']), ...dukmark.uses.map(u => DUKMARK_USE_LABEL[u] ?? u)]
  const shownTags = tags.slice(0, 2)
  const restTags = tags.length - shownTags.length

  const saveBtn = (
    <button type="button" aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'} onClick={e => { e.stopPropagation(); onToggleSave() }}
      style={variant === 'wide'
        ? { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.92)', boxShadow: '0 1px 4px rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: saved ? 'var(--accent)' : 'var(--text)' }
        : { border: 'none', background: 'none', padding: 2, display: 'flex', cursor: 'pointer', color: 'var(--accent)', flexShrink: 0 }}>
      <BookmarkIcon filled={saved} />
    </button>
  )

  const coverBox = (
    <div style={{ position: 'relative', aspectRatio: variant === 'wide' ? '16 / 9' : '4 / 3', background: 'var(--surface2)', overflow: 'hidden' }}>
      {cover
        ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', background: 'var(--accent-l, rgba(255,86,146,.12))' }}><LinkIcon /></div>}
      {variant === 'wide' && saveBtn}
    </div>
  )

  const title = (
    <div style={{ fontSize: variant === 'wide' ? 16 : 15, fontWeight: 800, lineHeight: 1.4, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }}>
      {post.title || '(제목 없음)'}
    </div>
  )

  if (variant === 'wide') {
    return (
      <article onClick={onOpen} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer' }}>
        {coverBox}
        <div style={{ padding: '12px 14px 12px' }}>
          {title}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {siteCount > 0 ? `사이트 ${siteCount}곳 · ` : ''}{author}{dukmark.byMaker && <span style={makerBadge}>제작자</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {shownTags.map(t => <span key={t} style={pinkTag}>{t}</span>)}
            {restTags > 0 && <span style={grayTag}>+{restTags}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HeartIcon />{post.likeCount}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AppIcon name="comment" size={15} />{post.commentCount}</span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article onClick={onOpen} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {coverBox}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {title}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {siteCount > 0 && <span style={grayTag}>사이트 {siteCount}곳</span>}
          <span style={grayTag}>{workNames[0] ?? '전체 공통'}</span>
          {dukmark.byMaker && <span style={{ ...makerBadge, marginLeft: 0 }}>제작자</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', fontSize: 13, color: 'var(--muted)' }}>
          <UserAvatar src={post.author?.avatarUrl ?? null} name={author} size={22} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{author}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><HeartIcon />{post.likeCount}</span>
          {saveBtn}
        </div>
      </div>
    </article>
  )
}

const pinkTag: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-l, rgba(255,86,146,.12))', padding: '4px 10px', borderRadius: 9999, whiteSpace: 'nowrap' }
const grayTag: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', background: 'var(--surface2)', padding: '4px 10px', borderRadius: 9999, whiteSpace: 'nowrap' }
const makerBadge: React.CSSProperties = { display: 'inline-block', marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 5, padding: '0 5px', verticalAlign: 'middle' }

function BookmarkIcon({ filled }: { filled: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" /></svg>
}
function HeartIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
}
function LinkIcon() {
  return <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
}
