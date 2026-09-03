import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/* 관리자 전용 — 샵 변경 '되돌리기(rollback)'가 유일한 호출부
   (services/shopChangeLogService.ts rollbackChange). shop_change_logs 의
   (target_table, field_name, old_value) 를 되돌린다.

   허용 필드·타입은 '실제 로깅되는 필드 + UI 입력 타입 + DB 제약'에서 도출(추측 아님):
     - shops.name/description/addr/parking_note/floor_info : text
     - shops.parking : boolean (UI 토글)
     - shops.shop_link : text, UI input type=url → http/https URL
     - shops.hours : jsonb(요일객체 mon~sun + holiday·yearRound 플래그)
     - shop_products.availability : text CHECK(6개 enum)
   목록 밖 field(=id/status/created_by/owner_id/승인 컬럼 등)는 400.

   ⚠️ 길이 상한은 DB에 제약이 없어 방어선용 '제안치'. 운영 승인 후 확정. */

type FieldRule =
  | { kind: 'text' | 'url'; nullable: boolean; maxLen: number }
  | { kind: 'boolean'; nullable: boolean }
  | { kind: 'enum'; nullable: boolean; values: readonly string[] }
  | { kind: 'hours'; nullable: boolean }

const RULES: Record<string, Record<string, FieldRule>> = {
  shops: {
    name:         { kind: 'text',    nullable: false, maxLen: 200 },
    description:  { kind: 'text',    nullable: true,  maxLen: 2000 },
    addr:         { kind: 'text',    nullable: true,  maxLen: 300 },
    parking_note: { kind: 'text',    nullable: true,  maxLen: 2000 },
    floor_info:   { kind: 'text',    nullable: true,  maxLen: 200 },
    shop_link:    { kind: 'url',     nullable: true,  maxLen: 500 },
    parking:      { kind: 'boolean', nullable: true },
    hours:        { kind: 'hours',   nullable: true },
  },
  shop_products: {
    // availability 는 DB CHECK 로 6개 enum + NOT NULL → null 은 400 으로 거부.
    availability: { kind: 'enum', nullable: false,
      values: ['unknown', 'not_sold', 'sold_out', 'few', 'normal', 'many'] },
  },
  shop_events: {}, // 허용 필드 없음 → 모든 field 400
}

const DAY_KEYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const DAY_FIELD_KEYS = new Set(['open', 'close', 'breakStart', 'breakEnd'])
const TIME_RE = /^\d{1,2}:\d{2}$/   // "HH:MM" — UI가 만드는 형식만

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

type Checked = { ok: true; value: unknown } | { ok: false; error: string }

function validate(rule: FieldRule, raw: unknown): Checked {
  if (Array.isArray(raw)) return { ok: false, error: '배열은 허용되지 않아요' }

  if (rule.kind === 'boolean') {
    if (raw === null) return rule.nullable ? { ok: true, value: null } : { ok: false, error: 'null 불가' }
    if (typeof raw !== 'boolean') return { ok: false, error: 'boolean 이어야 해요' }
    return { ok: true, value: raw }
  }

  if (rule.kind === 'enum') {
    if (raw === null) return rule.nullable ? { ok: true, value: null } : { ok: false, error: 'null 불가' }
    if (typeof raw !== 'string') return { ok: false, error: '문자열이어야 해요' }
    const t = raw.trim()
    if (t === '') return { ok: false, error: '비어있을 수 없어요' }
    if (!rule.values.includes(t)) return { ok: false, error: '허용되지 않은 값이에요' }
    return { ok: true, value: t }
  }

  if (rule.kind === 'hours') {
    if (raw === null) return { ok: true, value: null }
    if (!isPlainObject(raw)) return { ok: false, error: '영업시간 형식이 아니에요' }
    const days = Object.entries(raw)
    // 요일 7개 + holiday + yearRound
    if (days.length > 9) return { ok: false, error: '영업시간 키가 너무 많아요' }
    for (const [k, v] of days) {
      /* 위저드(ShopHoursEditor)는 요일 키와 같은 객체에 이 두 플래그를 넣는다.
         예전에는 mon~sun만 허용해서, 공휴일 휴무나 연중무휴가 켜진 샵은
         관리자 '변경 되돌리기'가 400으로 막혔다. 값은 켜짐 하나뿐이고
         끌 때는 키 자체를 지우므로 다른 값이 올 일이 없다. */
      if (k === 'holiday') {
        if (v !== 'closed') return { ok: false, error: '공휴일 값이 올바르지 않아요' }
        continue
      }
      if (k === 'yearRound') {
        if (v !== true) return { ok: false, error: '연중무휴 값이 올바르지 않아요' }
        continue
      }
      if (!DAY_KEYS.has(k)) return { ok: false, error: '알 수 없는 요일 키예요' }   // mon~sun 만
      if (v === null) continue
      if (!isPlainObject(v)) return { ok: false, error: '요일 값 형식 오류' }
      // 요일 값에 UI 스키마 외 키(중첩 객체 주입 등) 거부
      for (const dk of Object.keys(v)) {
        if (!DAY_FIELD_KEYS.has(dk)) return { ok: false, error: '요일 값에 허용되지 않은 키예요' }
      }
      if (typeof v.open !== 'string' || typeof v.close !== 'string')
        return { ok: false, error: 'open/close 형식 오류' }
      // open/close/break* 는 "HH:MM" 문자열만 (과대 문자열·깊은 객체 차단)
      for (const tk of ['open', 'close', 'breakStart', 'breakEnd']) {
        const tv = v[tk]
        if (tv == null) continue
        if (typeof tv !== 'string' || tv.length > 5 || !TIME_RE.test(tv))
          return { ok: false, error: '시간 형식 오류(' + tk + ')' }
      }
    }
    return { ok: true, value: raw }
  }

  // text / url — 숫자·불리언·객체 전부 거부(문자열만)
  if (raw === null) return rule.nullable ? { ok: true, value: null } : { ok: false, error: 'null 불가' }
  if (typeof raw !== 'string') return { ok: false, error: '문자열이어야 해요' }
  const trimmed = raw.trim()
  if (trimmed === '') return rule.nullable ? { ok: true, value: null } : { ok: false, error: '비어있을 수 없어요' }
  if (trimmed.length > rule.maxLen) return { ok: false, error: '값이 너무 길어요' }
  if (rule.kind === 'url') {
    let u: URL
    try { u = new URL(trimmed) } catch { return { ok: false, error: 'URL 형식이 아니에요' } }
    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      return { ok: false, error: 'http/https 만 허용돼요' }
  }
  return { ok: true, value: trimmed }
}

export async function PATCH(request: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const { table, id, field, value } = await request.json()
  if (!table || !id || !field) return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })

  const tableRules = RULES[table as string]
  if (!tableRules) return NextResponse.json({ error: '허용되지 않은 테이블이에요' }, { status: 400 })

  const rule = typeof field === 'string' ? tableRules[field] : undefined
  if (!rule) return NextResponse.json({ error: '허용되지 않은 필드예요' }, { status: 400 })

  const checked = validate(rule, value)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await adminSupabase
    .from(table)
    .update({ [field]: checked.value })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
