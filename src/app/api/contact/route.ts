import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { env } from '@/lib/env'
import { CONTACT_TYPES } from '@/components/contact/contactConfig'
import { PARTNER_TYPES } from '@/components/contact/partnerConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ============================================================
   문의 접수 — 로그인 사용자 전용

   첨부는 클라이언트가 말하는 대로 믿지 않는다
     요청에 attachment_urls 를 받지 않는다. 초안에 예약된 첨부를 DB 에서 읽고,
     Storage 에서 객체가 실제로 존재하는지·실제 크기가 얼마인지 확인한 뒤,
     그 결과만 RPC 에 넘긴다. URL 문자열은 RPC 가 경로에서 만든다.

   조회 실패를 "첨부 없음" 으로 바꾸지 않는다
     Storage 목록 조회가 실패했는데 그대로 진행하면, 사용자가 올린 파일이
     확인되지 않은 첨부로 분류돼 조용히 만료된다. 실패하면 접수를 중단한다.

   유형 목록을 여기에 다시 적지 않는다
     CONTACT_TYPES 와 PARTNER_TYPES 를 그대로 가져와 합집합으로 검증한다.
     목록이 두 곳에 있으면 어긋난다.
   ============================================================ */

const BUCKET = 'contact-files'
const MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set<string>([
  ...CONTACT_TYPES.map(t => t.key),
  ...PARTNER_TYPES.map(t => t.key),
])

const LIMITS = {
  title: 200,
  content: 5000,
  email: 200,
  pageUrl: 500,
  pageLabel: 200,
  extraKey: 60,
  extraValue: 1000,
  extraCount: 30,
  extraArray: 50,
  extraJson: 20000,
} as const

function statusOf(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === 'P0002') return 404
  if (code === '22023') return 400
  if (code === '23514') return 400
  return 500
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

interface Body {
  draftId?: unknown
  type?: unknown
  title?: unknown
  content?: unknown
  extra?: unknown
  email?: unknown
  pageUrl?: unknown
  pageLabel?: unknown
}

export async function POST(req: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const type = typeof body.type === 'string' ? body.type : ''
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: '알 수 없는 문의 유형이에요' }, { status: 400 })
  }

  const title = str(body.title, LIMITS.title)
  const content = str(body.content, LIMITS.content)
  const email = str(body.email, LIMITS.email)
  if (!title) return NextResponse.json({ error: '제목이 필요해요' }, { status: 400 })
  if (!email) return NextResponse.json({ error: '답변받을 이메일이 필요해요' }, { status: 400 })

  /* extra 는 폼마다 모양이 다르다. 문자열만 통과시키면 PartnerForm 의
     collab(문자열 배열)이 통째로 사라진다 — 어떤 협업을 원하는지가 지워진다.
     문자열·숫자·불린·문자열 배열까지 받고, 중첩 객체만 버린다. */
  const extra: Record<string, unknown> = {}
  if (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)) {
    for (const [k, v] of Object.entries(body.extra as Record<string, unknown>)) {
      if (Object.keys(extra).length >= LIMITS.extraCount) break
      const key = k.slice(0, LIMITS.extraKey)
      if (!key) continue

      if (typeof v === 'string') {
        const s = v.trim().slice(0, LIMITS.extraValue)
        if (s) extra[key] = s
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        extra[key] = v
      } else if (typeof v === 'boolean') {
        extra[key] = v
      } else if (Array.isArray(v)) {
        const arr = v
          .filter((x): x is string => typeof x === 'string')
          .slice(0, LIMITS.extraArray)
          .map(x => x.trim().slice(0, LIMITS.extraValue))
          .filter(Boolean)
        if (arr.length) extra[key] = arr
      }
      // 중첩 객체는 버린다
    }
  }
  if (JSON.stringify(extra).length > LIMITS.extraJson) {
    return NextResponse.json({ error: '추가 정보가 너무 커요' }, { status: 400 })
  }

  const draftIdIn = typeof body.draftId === 'string' && body.draftId ? body.draftId : null
  const svc = serviceClient()

  try {
    // 첨부 없이 접수하는 경우에도 초안을 거친다 — 제출 경로를 하나로 둔다
    let draftId = draftIdIn
    if (!draftId) {
      const { data, error } = await svc.rpc('contact_open_draft', { p_user: user.id })
      if (error) throw Object.assign(new Error(error.message), { code: error.code })
      const row = (Array.isArray(data) ? data[0] : data) as { draft_id: string } | null
      if (!row) throw new Error('초안을 열지 못했어요')
      draftId = row.draft_id
    }

    /* 이 초안에 예약된 첨부. 소유권은 RPC 가 다시 확인하지만,
       여기서도 user_id 로 걸러 남의 초안 경로를 뒤지지 않게 한다 */
    const { data: reserved, error: resErr } = await svc
      .from('contact_attachments')
      .select('id, object_path, slot_index')
      .eq('draft_id', draftId)
      .eq('user_id', user.id)
      .eq('status', 'reserved')
      .order('slot_index')
    if (resErr) throw new Error(`첨부 조회 실패: ${resErr.message}`)

    const verified: { id: string; size: number; content_type: string | null }[] = []

    if ((reserved ?? []).length > 0) {
      /* 객체 존재와 실제 크기를 Storage 에서 읽는다.
         경로가 {userId}/{draftId}/... 라 초안 폴더 하나만 보면 되고 최대 5개다.

         ⚠️ 조회가 실패하면 중단한다. 실패를 "첨부 없음" 으로 바꾸면
            사용자가 올린 파일이 조용히 만료된다. */
      const prefix = `${user.id}/${draftId}`
      const { data: listed, error: listErr } = await svc.storage
        .from(BUCKET)
        .list(prefix, { limit: 100 })
      if (listErr) throw new Error(`첨부 확인 실패: ${listErr.message}`)

      const found = new Map<string, { size: number; mimetype: string | null }>()
      for (const f of listed ?? []) {
        const meta = (f as { metadata?: { size?: number; mimetype?: string } }).metadata
        // 폴더 항목은 metadata 가 없다
        if (!meta || typeof meta.size !== 'number') continue
        found.set(f.name, { size: meta.size, mimetype: meta.mimetype ?? null })
      }

      for (const a of reserved ?? []) {
        const name = a.object_path.slice(prefix.length + 1)
        const hit = found.get(name)
        if (!hit) continue                    // 업로드되지 않음 → RPC 가 expired 로 넘긴다
        if (hit.size > MAX_BYTES) continue    // 버킷이 막지만 한 번 더 본다
        verified.push({ id: a.id, size: hit.size, content_type: hit.mimetype })
      }
    }

    const { data: subData, error: subErr } = await svc.rpc('contact_submit_draft', {
      p_user: user.id,
      p_draft: draftId,
      p_url_base: env.supabase.url,
      p_type: type,
      p_title: title,
      p_content: content || '(내용 없음)',
      p_extra: extra,
      p_email: email,
      p_page_url: str(body.pageUrl, LIMITS.pageUrl) || null,
      p_page_label: str(body.pageLabel, LIMITS.pageLabel) || null,
      p_verified: verified,
    })
    if (subErr) throw Object.assign(new Error(subErr.message), { code: subErr.code })

    const row = (Array.isArray(subData) ? subData[0] : subData) as {
      message_id: string; attached: number; expired: number; reused: boolean
    } | null
    if (!row) throw new Error('접수에 실패했어요')

    return NextResponse.json({
      ok: true,
      id: row.message_id,
      attached: row.attached,
      // 업로드가 끝나지 않아 빠진 첨부. 화면에서 알려줘야 한다
      dropped: row.expired,
      reused: row.reused,
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    const message = e instanceof Error ? e.message : '알 수 없는 오류'
    const status = statusOf(code)
    if (status >= 500) console.error('[contact]', code, message)
    return NextResponse.json({ error: message, code }, { status })
  }
}
