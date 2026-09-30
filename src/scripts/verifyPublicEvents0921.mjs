// 2026-09-21 등록분 공개 조회 검증 — anon 키(RLS 적용)로 이벤트·굿즈를 읽고, 이미지와 공개 상세 페이지 응답을 확인한다.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const site = 'https://www.takuroad.kr' // .env.local 의 APP_URL(jonjonnni.com)은 옛 배포라 404
const since = process.argv[2] ?? '2026-09-21T00:00:00Z'

const { data: events, error } = await anon.from('events')
  .select('id,title,type,tag_id,shop_id,start_date,end_date,cover_url,series_key,place_name,place_addr,source_urls, event_goods(id,name,kind,price,image_url,is_deleted)')
  .gte('created_at', since).order('title')
if (error) throw error

const head = async (url) => { try { const r = await fetch(url, { method: 'GET' }); return r.status } catch { return 'ERR' } }
const problems = []
const series = new Map()
for (const e of events) {
  const goods = (e.event_goods ?? []).filter((g) => !g.is_deleted)
  const coverStatus = e.cover_url ? await head(e.cover_url) : 'none'
  const goodsStatus = await Promise.all(goods.map((g) => (g.image_url ? head(g.image_url) : 'none')))
  const page = await fetch(`${site}/event/${e.id}`).then(async (r) => ({ status: r.status, hasTitle: false })).catch(() => ({ status: 'ERR', hasTitle: false }))
  if (!e.tag_id) problems.push(`${e.title}: tag_id 없음`)
  if (!e.shop_id && !e.place_addr) problems.push(`${e.title}: 샵도 주소도 없음`)
  if (coverStatus !== 200) problems.push(`${e.title}: 커버 ${coverStatus}`)
  goodsStatus.forEach((s, i) => { if (s !== 200) problems.push(`${e.title}: 굿즈 이미지 ${goods[i].name} ${s}`) })
  if (page.status !== 200) problems.push(`${e.title}: 공개 페이지 ${page.status}`)
  if (e.series_key) series.set(e.series_key, (series.get(e.series_key) ?? 0) + 1)
  console.log(`${page.status} cover:${coverStatus} goods:${goods.length}[${goodsStatus.join(',')}] shop:${e.shop_id ? 'Y' : '-'} ${e.start_date}~${e.end_date} ${e.title}`)
}
for (const [k, n] of series) if (n < 2) problems.push(`series_key 단독: ${k}`)
console.log(`\n이벤트 ${events.length}건 · 묶음 ${series.size}개 (${[...series.values()].join('/')})`)
console.log(problems.length ? `문제 ${problems.length}건:\n- ${problems.join('\n- ')}` : '문제 없음')
