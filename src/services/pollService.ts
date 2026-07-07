import { createClient } from '@/lib/supabase/client'
import { NewPoll, Poll, PollOption } from '@/types/community-post'

// 게시글에 투표 생성 (게시글 생성 직후 호출)
export async function createPoll(postId: string, data: NewPoll): Promise<boolean> {
  const supabase = createClient()
  const opts = data.options.map(o => o.trim()).filter(Boolean)
  if (!data.title.trim() || opts.length < 2) return false
  const { data: poll, error } = await supabase
    .from('post_polls')
    .insert({
      post_id: postId,
      title: data.title.trim(),
      multi: data.multi,
      anonymous: data.anonymous,
      view_mode: data.viewMode,
      sort_mode: data.sortMode,
      end_mode: data.endMode,
      end_at: data.endMode === 'date' ? (data.endAt || null) : null,
      max_participants: data.endMode === 'count' ? (data.maxParticipants ?? null) : null,
    } as any)
    .select('id')
    .single()
  if (error || !poll) { console.error('[투표 생성 실패]', error?.message); return false }
  const rows = opts.map((label, i) => ({ poll_id: poll.id, label, position: i }))
  const { error: e2 } = await supabase.from('poll_options').insert(rows as any)
  if (e2) { console.error('[선택지 생성 실패]', e2.message); return false }
  return true
}

// 게시글의 투표 조회 (결과 공개 규칙 + 자동 마감 반영)
export async function getPollByPost(postId: string, userId?: string | null): Promise<Poll | null> {
  const supabase = createClient()
  const { data: p0 } = await supabase.from('post_polls').select('*').eq('post_id', postId).maybeSingle()
  if (!p0) return null
  // 종료일 경과 시 자동 마감
  await supabase.rpc('close_expired_poll', { p_poll: (p0 as any).id })
  const { data: pp } = await supabase.from('post_polls').select('*').eq('id', (p0 as any).id).maybeSingle()
  const poll: any = pp ?? p0

  const { data: options } = await supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('position', { ascending: true })
  const { data: votes } = await supabase.from('poll_votes').select('option_id, user_id').eq('poll_id', poll.id)
  const allVotes = votes ?? []
  const participants = new Set(allVotes.map((v: any) => v.user_id)).size
  const myVotes = new Set(allVotes.filter((v: any) => userId && v.user_id === userId).map((v: any) => v.option_id))
  const hasVoted = myVotes.size > 0

  const now = Date.now()
  const closed = !!poll.closed
    || (poll.end_mode === 'date' && poll.end_at && new Date(poll.end_at).getTime() <= now)
    || (poll.end_mode === 'count' && poll.max_participants != null && participants >= poll.max_participants)
  const canSeeResults = poll.view_mode === 'always'
    || (poll.view_mode === 'after' && hasVoted)
    || (poll.view_mode === 'ended' && closed)

  let opts: PollOption[] = (options ?? []).map((o: any) => ({
    id: o.id, label: o.label, position: o.position, voteCount: o.vote_count, votedByMe: myVotes.has(o.id),
  }))
  if (poll.sort_mode === 'votes') opts = [...opts].sort((a, b) => b.voteCount - a.voteCount)

  return {
    id: poll.id, title: poll.title, multi: poll.multi, anonymous: poll.anonymous,
    viewMode: poll.view_mode, sortMode: poll.sort_mode, endMode: poll.end_mode,
    endAt: poll.end_at ?? null, maxParticipants: poll.max_participants ?? null,
    closed: !!closed, totalVotes: allVotes.length, participants, hasVoted, canSeeResults,
    options: opts,
  }
}

// 투표 (단일/복수, 재투표 시 교체). 반환: 'ok'|'closed'|'single_only'|'empty'|'not_found'|'error'
export async function votePoll(pollId: string, optionIds: string[], userId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('cast_poll_vote', { p_poll: pollId, p_options: optionIds, p_user: userId })
  if (error) { console.error('[투표 실패]', error.message); return 'error' }
  return (data as string) ?? 'ok'
}
