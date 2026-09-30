// 국전 기존 샵 호수 보완 — 사용자 제공 목록(2026-09-29). 비어 있던 호수만 채움(기존 호수와 다른 값은 건드리지 않음)
// floor_info + branches(room) 같이 갱신, sns 추가. 사용: node scripts/shops/kukjeUserRooms-2026-09-29.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'node:fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'

// name 접두 → { floor_info, rooms: {branch index: room}, sns_add }
const PLAN = {
  '가챠노모리': { floor_info: '국제전자센터 3층 149호', rooms: { 0: '149호' } },
  '가챠마을': { floor_info: '국제전자센터 9층 104호', rooms: { 0: '104호' } },
  '더굿즈 국전점': { floor_info: '국제전자센터 5층 104호', rooms: { 0: '104호' } },
  '마로굿즈': { floor_info: '국제전자센터 5층 142호', rooms: { 0: '142호' } },
  '토피코 국제전자센터점': { floor_info: '국제전자센터 3층 84호', rooms: { 0: '84호' } },
  '피규어프레소 서초점': { floor_info: '국제전자센터 9층 62호 (1~3호점)', rooms: { 0: '62호' } },
  '애니랩스 국제전자센터점': { floor_info: '국제전자센터 5층 · 3층 77·135호(가챠점) · 8층 45호(프리미엄 쿠지샵)', rooms: { 1: '77·135호', 2: '45호' } },
  // 네이버 플레이스 1644025120 '쿠지방 국제전자센터점' 도로명 '효령로 304 8층 8124, 8125호' (2026-09-29, 사용자 제보)
  '쿠지방 국제전자센터점': { sns_add: ['https://www.instagram.com/kujibang/'], floor_info: '국제전자센터 8층 8124·8125호', rooms: { 0: '8124·8125호' }, room_overwrite: true, desc_replace: ['8층 8123호', '8층 8124·8125호'] },
  // 공식 대조(2026-09-29): X @E_stareggstore2 2026-02-22 오픈 공지 "국제전자센터 946호 (9층) 운영시간 14:30~19:30", 매주 화요일 휴무
  '이스타에그 국전점': { floor_info: '국제전자센터 7층(본점) · 9층 946호(2호점)', rooms: { 1: '946호' },
    desc_replace: ['· 9층 2호점: 매주 화요일 정기휴무', '· 9층 946호 2호점: 14:30~19:30, 매주 화요일 정기휴무'] },
  // X @ttabbaemall 2026-09-01 "국제전자센터 3층 88호 … 월~일 AM11:30~PM19:00"
  '따빼몰 국제전자센터점': { floor_info: '국제전자센터 3층 88호', rooms: { 0: '88호' }, room_overwrite: true },
  // X @Miracle_kuji 2026-04-08 "국제전자센터 1호점 (… 3층 135호)", 매장 당근 프로필 "미라클쿠지 국전 1,2호점 3층 3135, 3136호"
  '미라클쿠지 국전점': { floor_info: '국제전자센터 3층 135·136호 (1호점·2호점)',
    branches: [{ floor: '3층', name: '1호점', room: '135호', items: ['제일복권'] }, { floor: '3층', name: '2호점', room: '136호', items: ['자체 쿠지', '가챠'] }] },
}
const out = []
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)
for (const [name, p] of Object.entries(PLAN)) {
  if (only && name !== only) continue
  const r = await db.from('shops').select('id,name,floor_info,branches,sns_links,description,updated_at').ilike('addr', '%효령로 304%').eq('name', name).neq('status', 'deleted')
  if (r.error || r.data.length !== 1) { out.push({ name, status: 'NOT_FOUND', n: r.data?.length }); continue }
  const row = r.data[0]
  const patch = {}
  if (p.floor_info && p.floor_info !== row.floor_info) patch.floor_info = p.floor_info
  if (p.rooms) {
    const b = structuredClone(row.branches ?? [])
    for (const [i, room] of Object.entries(p.rooms)) if (b[i] && (!b[i].room || p.room_overwrite)) b[i].room = room
    if (JSON.stringify(b) !== JSON.stringify(row.branches)) patch.branches = b
  }
  if (p.branches && JSON.stringify(p.branches) !== JSON.stringify(row.branches)) patch.branches = p.branches
  if (p.desc_replace && row.description?.includes(p.desc_replace[0])) patch.description = row.description.replace(p.desc_replace[0], p.desc_replace[1])
  if (p.sns_add) {
    const s = [...(row.sns_links ?? [])]
    for (const u of p.sns_add) if (!s.some(x => x.replace(/\/$/, '') === u.replace(/\/$/, ''))) s.push(u)
    if (s.length !== (row.sns_links ?? []).length) patch.sns_links = s
  }
  if (!Object.keys(patch).length) { out.push({ name, status: 'NO_CHANGE' }); continue }
  if (dry) { out.push({ name, status: 'DRY', patch }); continue }
  const u = await db.from('shops').update(patch).eq('id', row.id).eq('updated_at', row.updated_at).select('id')
  if (u.error || !u.data.length) { out.push({ name, status: u.error ? 'ERROR ' + u.error.message : 'SKIP_RACE' }); continue }
  for (const [f, v] of Object.entries(patch))
    await db.from('shop_change_logs').insert({ shop_id: row.id, target_table: 'shops', field_name: f, old_value: row[f] ?? null, new_value: v,
      change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })
  out.push({ name, status: 'UPDATED', before: Object.fromEntries(Object.keys(patch).map(k => [k, row[k]])), patch })
}
await writeFile(`scripts/shops/runs/kukje-user-rooms-${dry ? 'dry-' : ''}${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify(out, null, 1))
for (const o of out) console.log(o.status, o.name, JSON.stringify(o.patch ?? ''))
