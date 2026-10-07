'use client'

/* 마이페이지 › 내 활동 — '작성한 글'과 '내 댓글'을 한 화면으로 합쳤다.
   - 위: 마이페이지로 → 내 활동 → 설명 → [내 글 | 내 댓글] (기본 내 글, 글·댓글을 섞는 '전체' 탭은 없음)
   - 목록은 표가 아니라 '내 활동 목록' — 흰 배경 · 핑크 포인트 · 얇은 구분선
   - 데이터·정렬·이동은 예전 두 화면(MyPostsTab / MyCommentsTab) 그대로:
       내 글   getMyPosts — 숨김 글 포함, 최신순, 누르면 /community/:id, 숨김 글은 이의제기(AppealModal)
       내 댓글 getAllMyComments — 커뮤니티 + 후기 댓글, 최신순, 누르면 원글의 그 댓글 위치(?comment=)로
   - 두 목록 다 한 번에 전부 불러오는 방식(페이지 나눔 없음)이라 개수는 실제 전체 개수다
   - 탭을 바꿔도 각 목록은 그대로 두고(다시 불러오지 않음), 스크롤 위치도 탭마다 기억했다가 돌려준다 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyPosts } from '@/services/communityPostService'
import { getAllMyComments } from '@/services/commentService'
import { CommunityPost, BOARD_LABEL, REASON_LABEL } from '@/types/community-post'
import { ROUTES } from '@/lib/constants/routes'
import AppealModal from '@/components/community/AppealModal'
import ThumbImg from '@/components/common/ThumbImg'
import styles from './MyActivity.module.css'

export type ActivityTab = 'posts' | 'comments'

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'done'; items: T[] }

export const fmtDate = (s: string) => {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`
}

/** 글 본문은 에디터 HTML 이라 목록에선 글자만 꺼내 보여준다 */
export function plainText(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}
/** 본문 속 첫 이미지 (따로 저장된 이미지가 없을 때 썸네일로) */
export function firstImg(html: string | null | undefined): string | null {
  const m = html ? /<img[^>]+src=["']([^"']+)["']/i.exec(html) : null
  return m ? m[1] : null
}

const Chev = () => <svg className={styles.chev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
const Reply = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M5 4v7a4 4 0 0 0 4 4h10" /><path d="m15 11 4 4-4 4" /></svg>

/** 스크롤될 수 있는 곳들 — 화면(문서)과, 있으면 감싸는 스크롤 칸. 탭마다 둘 다 기억해 둔다 */
export function scrollersOf(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [(document.scrollingElement as HTMLElement) ?? document.documentElement]
  let p = el?.parentElement ?? null
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') { out.push(p); break }
    p = p.parentElement
  }
  return out
}

export default function MyActivityView({ userId, initialTab = 'posts', onBack }: {
  userId: string
  initialTab?: ActivityTab
  onBack: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<ActivityTab>(initialTab)
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const [posts, setPosts] = useState<Load<CommunityPost>>({ state: 'loading' })
  const [comments, setComments] = useState<Load<any>>({ state: 'loading' })
  const [postsKey, setPostsKey] = useState(0)        // 이의제기 접수 후·다시 시도 시 다시 불러오기
  const [commentsKey, setCommentsKey] = useState(0)
  const [appealing, setAppealing] = useState<CommunityPost | null>(null)

  useEffect(() => {
    let alive = true
    setPosts({ state: 'loading' })
    getMyPosts(userId)
      .then(items => { if (alive) setPosts({ state: 'done', items }) })
      .catch(() => { if (alive) setPosts({ state: 'error' }) })
    return () => { alive = false }
  }, [userId, postsKey])

  useEffect(() => {
    let alive = true
    setComments({ state: 'loading' })
    getAllMyComments(userId)
      .then(items => { if (alive) setComments({ state: 'done', items }) })
      .catch(() => { if (alive) setComments({ state: 'error' }) })
    return () => { alive = false }
  }, [userId, commentsKey])

  // 탭마다 스크롤 위치 기억 → 돌아오면 그 자리로
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollPos = useRef<Record<ActivityTab, number[]>>({ posts: [], comments: [] })
  const switchTab = (next: ActivityTab) => {
    if (next === tab) return
    scrollPos.current[tab] = scrollersOf(wrapRef.current).map(s => s.scrollTop)
    restoreFor.current = next
    setTab(next)
  }
  // 탭이 바뀐 직후(그리기 전에) 그 탭의 스크롤 위치로 돌려놓는다
  const restoreFor = useRef<ActivityTab | null>(null)
  useLayoutEffect(() => {
    if (restoreFor.current !== tab) return
    restoreFor.current = null
    const saved = scrollPos.current[tab]
    scrollersOf(wrapRef.current).forEach((s, i) => { s.scrollTop = saved[i] ?? 0 })
  }, [tab])

  function goComment(c: any) {
    if (c.kind === 'shop' && c.slug) router.push(ROUTES.shop(c.slug) + '?comment=' + c.id + '&review=' + (c.reviewId ?? ''))
    else if (c.kind === 'post' && c.postId) router.push('/community/' + c.postId + '?comment=' + c.id)
  }

  const count = (l: Load<unknown>) => (l.state === 'done' ? l.items.length : null)
  const tabBtn = (key: ActivityTab, label: string, n: number | null) => (
    <button key={key} type="button" role="tab" aria-selected={tab === key}
      className={tab === key ? `${styles.tab} ${styles.tabOn}` : styles.tab} onClick={() => switchTab(key)}>
      {label}{n != null && <span className={styles.tabCount}>{n}</span>}
    </button>
  )

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inner}>
        <button type="button" className={styles.back} onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          마이페이지
        </button>
        <h1 className={styles.title}>내 활동</h1>
        <p className={styles.desc}>내가 쓴 글과 댓글을 모아봤어요.</p>

        <div className={styles.tabs} role="tablist" aria-label="내 활동">
          {tabBtn('posts', '내 글', count(posts))}
          {tabBtn('comments', '내 댓글', count(comments))}
        </div>

        {/* 두 목록 모두 그려 두고 하나만 보여준다 — 탭을 오가도 다시 불러오지 않는다 */}
        <div role="tabpanel" hidden={tab !== 'posts'}>
          <PostList load={posts} onRetry={() => setPostsKey(k => k + 1)} onOpen={p => router.push('/community/' + p.id)} onAppeal={setAppealing} />
        </div>
        <div role="tabpanel" hidden={tab !== 'comments'}>
          <CommentList load={comments} onRetry={() => setCommentsKey(k => k + 1)} onOpen={goComment} />
        </div>
      </div>

      {appealing && (
        <AppealModal
          post={appealing}
          onClose={() => setAppealing(null)}
          onDone={() => { setAppealing(null); setPostsKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

function StateBox({ load, emptyText, onRetry, kind }: { load: Load<unknown>; emptyText: string; onRetry: () => void; kind: string }) {
  if (load.state === 'loading') return <div aria-busy="true" aria-label={`${kind} 불러오는 중`}>{[0, 1, 2, 3].map(i => <div key={i} className={styles.skel} />)}</div>
  if (load.state === 'error') return (
    <div className={styles.state}>
      {kind}을 불러오지 못했어요.
      <div><button type="button" className={styles.stateBtn} onClick={onRetry}>다시 시도</button></div>
    </div>
  )
  return <div className={styles.state}>{emptyText}</div>
}

function PostList({ load, onRetry, onOpen, onAppeal }: {
  load: Load<CommunityPost>; onRetry: () => void; onOpen: (p: CommunityPost) => void; onAppeal: (p: CommunityPost) => void
}) {
  if (load.state !== 'done' || load.items.length === 0) return <StateBox load={load} emptyText="아직 작성한 글이 없어요" onRetry={onRetry} kind="내 글" />
  return (
    <ul className={styles.list}>
      {load.items.map(p => {
        const hidden = p.status === 'hidden'
        const text = plainText(p.content)
        const title = p.title || (text ? text.slice(0, 60) : '(제목 없음)')
        const preview = p.title && text ? text : null
        const thumb = p.images?.[0] ?? firstImg(p.content)
        return (
          <li key={p.id} className={styles.item}>
            <button type="button" className={styles.row} onClick={() => onOpen(p)}>
              <div className={styles.main}>
                <div className={styles.meta}>
                  <span className={styles.kind}>{BOARD_LABEL[p.board] ?? '커뮤니티'}</span>
                  {hidden && <span className={styles.hiddenChip}>임시 숨김</span>}
                  <span className={styles.date}>{fmtDate(p.createdAt)}</span>
                </div>
                <p className={styles.postTitle}>{title}</p>
                {preview && <p className={styles.preview}>{preview}</p>}
                <div className={styles.stats}>
                  <span>댓글 {p.commentCount ?? 0}</span>
                  <span>좋아요 {p.likeCount ?? 0}</span>
                  <span>조회 {p.viewCount ?? 0}</span>
                </div>
              </div>
              {thumb && <ThumbImg className={styles.thumb} src={thumb} alt="" loading="lazy" />}
              <Chev />
            </button>
            {hidden && (
              <div className={styles.appeal}>
                <p>
                  신고가 접수되어 <b>관리자 확인 전까지 임시 숨김</b> 처리되었어요{p.hiddenReason ? ` (사유: ${REASON_LABEL[p.hiddenReason] ?? p.hiddenReason})` : ''}.
                  본인의 창작물이거나 문제가 없다면 소명해 주세요. 검토 후 다시 공개될 수 있어요.
                </p>
                <button type="button" className={styles.appealBtn} onClick={() => onAppeal(p)}>이의제기하기 →</button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CommentList({ load, onRetry, onOpen }: { load: Load<any>; onRetry: () => void; onOpen: (c: any) => void }) {
  if (load.state !== 'done' || load.items.length === 0) return <StateBox load={load} emptyText="아직 작성한 댓글이 없어요" onRetry={onRetry} kind="내 댓글" />
  return (
    <ul className={styles.list}>
      {load.items.map((c: any) => {
        // 원글이 지워졌거나 볼 수 없으면 이동하지 않는다 (예전엔 없는 글로 보내 '찾을 수 없음'이 떴다)
        const gone = !!c.originMissing
        const canOpen = !gone && ((c.kind === 'shop' && c.slug) || (c.kind === 'post' && c.postId))
        const inner = (
          <>
            <div className={styles.main}>
              <div className={styles.meta}>
                <span className={c.kind === 'post' ? styles.kind : styles.kindMuted}>{c.source}</span>
                <span className={styles.date}>{fmtDate(c.created_at)}</span>
              </div>
              <p className={styles.body}>{plainText(c.content) || '(내용 없음)'}</p>
              <div className={styles.origin}>
                <Reply />
                {gone
                  ? <span className={`${styles.originText} ${styles.originGone}`}>{c.kind === 'post' ? '삭제되었거나 볼 수 없는 글' : '삭제되었거나 볼 수 없는 샵'}</span>
                  : <span className={styles.originText}>{c.kind === 'shop' ? `${c.title} 후기` : c.title}</span>}
              </div>
            </div>
            {canOpen && <Chev />}
          </>
        )
        return (
          <li key={c.kind + c.id} className={styles.item}>
            {canOpen
              ? <button type="button" className={styles.row} onClick={() => onOpen(c)}>{inner}</button>
              : <div className={`${styles.row} ${styles.rowStatic}`}>{inner}</div>}
          </li>
        )
      })}
    </ul>
  )
}
