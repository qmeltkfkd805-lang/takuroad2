'use client'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { getMyPosts } from '@/services/communityPostService'
import { CommunityPost, REASON_LABEL } from '@/types/community-post'
import AppealModal from '@/components/community/AppealModal'
import { LoadingState } from './SavedShopsTab'

/* 프로필 > 작성한 글.

   getMyPosts 는 숨김(status='hidden') 글까지 돌려주는데 예전에는 제목·댓글·조회·작성일만
   그려서, 내 글이 숨겨졌다는 것을 알 방법이 없었다. 이의제기 폼은 /mypage/posts 에만
   있었고 그 주소로 가는 링크가 코드 어디에도 없어서 사실상 닿을 수 없는 기능이었다.
   그 화면을 지우고 여기로 합쳤다. */

export default function MyPostsTab({ userId }: { userId: string }) {
  const router = useRouter()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  // 이의제기 접수 후 다시 불러오기 (키를 올려 effect 를 다시 돌린다)
  const [reload, setReload] = useState(0)
  const [appealing, setAppealing] = useState<CommunityPost | null>(null)

  useEffect(() => {
    let alive = true
    getMyPosts(userId).then(data => {
      if (!alive) return
      setPosts(data); setLoading(false)
    })
    return () => { alive = false }
  }, [userId, reload])

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
            <th style={{ textAlign: 'left', padding: '12px 8px' }}>제목</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', width: 50, whiteSpace: 'nowrap' }}>댓글</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', width: 50, whiteSpace: 'nowrap' }}>조회</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', width: 90, whiteSpace: 'nowrap' }}>작성일</th>
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>작성한 글이 없어요</td></tr>
          ) : (
            posts.map(p => {
              const hidden = p.status === 'hidden'
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => router.push('/community/' + p.id)}
                    style={{ borderBottom: hidden ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 8px', fontWeight: 700, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hidden && (
                        <span style={{ marginRight: 6, fontSize: 11.5, fontWeight: 800, color: '#c0392b', background: 'rgba(239,90,90,.1)', padding: '2px 8px', borderRadius: 9999 }}>임시 숨김</span>
                      )}
                      {p.title || (p.content ? p.content.slice(0, 30) : '(제목 없음)')}
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.commentCount ?? 0}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.viewCount ?? 0}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'right', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>

                  {hidden && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <div style={{ background: 'rgba(239,90,90,.07)', padding: '12px 14px 14px' }}>
                          <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px', color: 'var(--text)' }}>
                            신고가 접수되어 <b>관리자 확인 전까지 임시 숨김</b> 처리되었어요{p.hiddenReason ? ` (사유: ${REASON_LABEL[p.hiddenReason] ?? p.hiddenReason})` : ''}.
                            본인의 창작물이거나 문제가 없다면 아래에서 소명해 주세요. 검토 후 다시 공개될 수 있어요.
                          </p>
                          <button
                            onClick={() => setAppealing(p)}
                            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: 'var(--accent)', textDecoration: 'underline' }}
                          >
                            이의제기하기 →
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>

      {appealing && (
        <AppealModal
          post={appealing}
          onClose={() => setAppealing(null)}
          onDone={() => { setAppealing(null); setReload(k => k + 1) }}
        />
      )}
    </div>
  )
}
