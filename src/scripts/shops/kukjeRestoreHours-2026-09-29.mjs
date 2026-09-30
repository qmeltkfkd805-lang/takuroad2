// 국전 영업시간 되돌리기 — 사용자 지시 2026-09-29
// kukjeBranchesHours 로 10:00~20:00 통일하기 전에 요일별 시간이 따로 있던 샵은 원래 요일 시간으로 복원하고,
// 정기휴무(monthlyOff 첫째·셋째 일요일)는 유지. OVERRIDE 에 공식 재확인으로 바뀐 값이 있으면 그 값을 쓴다.
// 사용: node scripts/shops/kukjeRestoreHours-2026-09-29.mjs <before-backup.json> [--dry] [--override overrides.json]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, writeFile } from 'node:fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const oi = args.indexOf('--override')
const OVERRIDE = oi >= 0 ? JSON.parse(await readFile(args[oi + 1], 'utf8')) : {}
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const OFF = { weeks: [1, 3], days: ['sun'] }
const before = JSON.parse(await readFile(args.find(a => a.endsWith('.json') && (oi < 0 || a !== args[oi + 1])), 'utf8'))

const out = []
const ids = new Set([...before.filter(s => s.hours && DAYS.some(d => d in s.hours)).map(s => s.id), ...Object.keys(OVERRIDE)])
for (const id of ids) {
  const cur = await db.from('shops').select('id,name,hours,updated_at').eq('id', id).single()
  if (cur.error) { out.push({ id, status: 'ERROR', error: cur.error.message }); continue }
  const row = cur.data
  const src = OVERRIDE[id] ?? before.find(s => s.id === id).hours
  const hours = {}
  for (const d of DAYS) if (d in src) hours[d] = src[d]
  if (src.yearRound) hours.yearRound = true
  hours.monthlyOff = OFF
  if (JSON.stringify(sort(hours)) === JSON.stringify(sort(row.hours))) { out.push({ name: row.name, status: 'NO_CHANGE' }); continue }
  if (dry) { out.push({ name: row.name, status: 'DRY', hours }); continue }
  const u = await db.from('shops').update({ hours }).eq('id', id).eq('updated_at', row.updated_at).select('id')
  if (u.error) { out.push({ name: row.name, status: 'ERROR', error: u.error.message }); continue }
  if (!u.data.length) { out.push({ name: row.name, status: 'SKIP_RACE' }); continue }
  await db.from('shop_change_logs').insert({ shop_id: id, target_table: 'shops', field_name: 'hours', old_value: row.hours, new_value: hours,
    change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })
  out.push({ name: row.name, status: 'UPDATED', hours })
}
function sort(h) { return h ? Object.fromEntries(Object.entries(h).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? sort(v) : v])) : h }
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
await writeFile(`scripts/shops/runs/kukje-restore-hours-${dry ? 'dry-' : ''}${stamp}.json`, JSON.stringify({ dry, out }, null, 1))
const fmt = h => DAYS.map(d => `${d}:${h?.[d] ? h[d].open + '-' + h[d].close : h && d in h ? 'X' : '-'}`).join(' ')
console.log(out.map(o => `${o.status}\t${o.name ?? o.id}\t${o.hours ? fmt(o.hours) : ''}${o.error ? ' ' + o.error : ''}`).join('\n'))
