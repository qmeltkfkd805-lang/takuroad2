// 국제전자센터(효령로 304) 샵 일괄 — 사용자 지시 2026-09-29
//  1) 층별 매장 구성(branches) 입력 (이미 입력된 샵은 유지 — 쿄우마샵)
//  2) 요일별 영업시간을 건물 운영시간(매일 10:00~20:00)으로 통일
//  3) 영업상태 정기휴무: 매월 첫째·셋째 일요일(hours.monthlyOff)
// 사용: node scripts/shops/kukjeBranchesHours-2026-09-29.mjs [--dry]
// 변경 전 행 백업(backups/), shop_change_logs 기록, updated_at 낙관적 갱신, 결과 runs/
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile, mkdir } from 'node:fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const DIR = 'scripts/shops'
const DAY = { open: '10:00', close: '20:00' }
const HOURS = { mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: DAY, sat: DAY, sun: DAY, monthlyOff: { weeks: [1, 3], days: ['sun'] } }
const B = (floor, name, room, items) => ({ floor, name, ...(room ? { room } : {}), items })

// id 앞 8자리 → 층별 구성 (floor_info·description·취급 분류 기준, 새 사실 추가 없음)
const BR = {
  '14fe688a': [B('9층', '본점', '26호', ['제일복권', '굿즈', '피규어', '가챠'])],
  '242fdebd': [B('5층', '매장', '', ['자체 쿠지'])],
  '11576ecf': [B('8층', '매장', '', ['제일복권'])],
  '55cceabf': [B('5층', '매장', '', ['가챠'])],
  '54903f15': [B('9층', '매장', '', ['가챠'])],
  '2fd0ee28': [B('8층', '매장', '8123호', ['제일복권', '자체 쿠지', '피규어'])],
  '9b08d92b': [B('4층', '가챠샵', '', ['가챠']), B('8층', '가챠샵', '', ['가챠'])],
  'cda3407d': [B('9층', '매장', '97호', ['굿즈', '제일복권', '피규어'])],
  '05ad9eca': [B('5층', '매장', '', ['가챠'])],
  '3a10f5d8': [B('3층', '매장', '', ['가챠'])],
  '1dcf2565': [B('9층', '매장', '', ['가챠'])],
  '89fc20de': [B('9층', '매장', '', ['중고 게임', '가챠'])],
  '3d849a0a': [B('9층', '매장', '', ['게임', '가챠'])],
  '7a5dbcf0': [B('3층', '매장', '49·50·51·149호', ['굿즈', '인형'])],
  '8573e461': [B('8층', '국전점(2호점)', '80·87호', ['굿즈', '피규어'])],
  '0cfbecc6': [B('8층', '매장', '', ['가챠'])],
  'bb3e223a': [B('9층', '매장', '중앙 에스컬레이터 앞', ['자체 쿠지', '카드', '피규어'])],
  '1544e21f': [B('3층', '매장', '', ['가챠', '제일복권'])],
  '07fd4a96': [B('3층', '매장', '3호', ['굿즈', '인형', '제일복권'])],
  '0a8cbca8': [B('9층', '매장', '34호', ['프라모델', '피규어', '도료/공구'])],
  '2a0353e9': [B('3층', '매장', '', ['하위상 교환', '피규어 매입']), B('6층', '매장', '', ['방문 수령']), B('7층', '고객센터', '', []), B('9층', '매장', '', [])],
  '50bec545': [B('7층', '매장', '7122호', ['굿즈', '피규어'])],
  'f380e438': [B('9층', '매장', '', ['피규어'])],
  'd63eb21a': [B('9층', '매장', '42·44호', ['굿즈', '피규어', '제일복권'])],
  '6774a8a7': [B('5층', '매장', '', ['피규어', '자체 쿠지', '굿즈']), B('3층', '가챠점', '', ['가챠']), B('8층', '프리미엄 쿠지샵', '', ['쿠지'])],
  '1bdef20f': [B('9층', '1~3호점', '', ['피규어'])],
  'da4b3714': [B('3층', '매장', '3134호', ['가챠', '제일복권', '피규어'])],
  '94f6d97c': [B('9층', '매장', '001~003호', ['굿즈', '피규어'])],
  'f9f1833f': [B('3층', '매장', '151호', ['인형', '피규어', '굿즈'])],
  '4cf43796': [B('8층', '매장', '115·116호', ['제일복권', '가챠', '피규어', '인형'])],
  '2f1321e8': [B('7층', '본점', '', ['굿즈', '피규어', '카드']), B('9층', '2호점', '', [])],
  '09906df3': [B('6층', '매장', '45·46호', ['중고', '피규어', '굿즈'])],
  '15c0501e': [B('3층', '매장', '81~83·88호', ['굿즈', '인형', '피규어'])],
  '1868a417': [B('3층', '매장', '3023~3027·3086~3087·3096~3099호', ['가챠', '자체 쿠지'])],
  '32c022af': [B('8층', '매장', '8031호', ['제일복권', '피규어', '굿즈', '가챠'])],
  'abfc89ce': [B('3층', '1·2호점', '41호', ['제일복권', '자체 쿠지', '가챠'])],
  'f54325f2': [B('7층', '매장', '45호', ['굿즈', '피규어', '가챠'])],
  'eeaaec9c': [B('9층', '1호점', '110호', ['피규어', '굿즈']), B('9층', '2호점', '45호', ['제일복권'])],
  '42123449': [B('8층', '매장', '155~157호', ['굿즈', '피규어', '제일복권'])],
  '9f394800': [B('3층', '2호점', '3009호', ['제일복권', '자체 쿠지', '피규어', '굿즈'])],
  'fcd66bed': [B('9층', '매장', '114호', ['게임', '게임 굿즈'])],
  'eb2b57de': [B('3층', '매장', '132호', ['가챠', '인형'])],
  'e1c622c2': [B('6층', '매장', '', ['제일복권', '피규어'])],
}

const r = await db.from('shops').select('*').ilike('addr', '%효령로 304%').neq('status', 'deleted')
if (r.error) throw r.error
const rows = r.data
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
if (!dry) {
  await mkdir(`${DIR}/backups`, { recursive: true })
  await writeFile(`${DIR}/backups/kukje-branches-hours-before-${stamp}.json`, JSON.stringify(rows, null, 1))
}
const out = []
for (const row of rows) {
  const k = row.id.slice(0, 8)
  const patch = {}
  if (!(Array.isArray(row.branches) && row.branches.length)) {
    if (BR[k]) patch.branches = BR[k]
    else out.push({ name: row.name, status: 'NO_BRANCH_DEF' })
  }
  if (JSON.stringify(row.hours) !== JSON.stringify(HOURS)) patch.hours = HOURS
  if (!Object.keys(patch).length) { out.push({ name: row.name, status: 'NO_CHANGE' }); continue }
  if (dry) { out.push({ name: row.name, status: 'DRY', fields: Object.keys(patch) }); continue }
  const u = await db.from('shops').update(patch).eq('id', row.id).eq('updated_at', row.updated_at).select('id')
  if (u.error) { out.push({ name: row.name, status: 'ERROR', error: u.error.message }); continue }
  if (!u.data.length) { out.push({ name: row.name, status: 'SKIP_RACE' }); continue }
  for (const [f, v] of Object.entries(patch)) {
    await db.from('shop_change_logs').insert({ shop_id: row.id, target_table: 'shops', field_name: f, old_value: row[f] ?? null, new_value: v,
      change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })
  }
  out.push({ name: row.name, status: 'UPDATED', fields: Object.keys(patch) })
}
await writeFile(`${DIR}/runs/kukje-branches-hours-${dry ? 'dry-' : ''}${stamp}.json`, JSON.stringify({ at: stamp, dry, total: rows.length, out }, null, 1))
console.log(`total ${rows.length}`)
console.log(out.map(o => `${o.status}\t${o.name}\t${o.fields ?? ''}${o.error ? ' ' + o.error : ''}`).join('\n'))
