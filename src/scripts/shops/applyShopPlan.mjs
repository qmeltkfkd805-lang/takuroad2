// 샵 등록·정보 보완 적용기 (샵 전용 작업 — 이벤트는 shop_id 연결만, 그 외 필드는 읽기만 한다)
//
//   node scripts/shops/applyShopPlan.mjs scripts/shops/plans/<plan>.json [--dry]
//
// 계획 파일 형식:
//   { "name": "2026-09-23", "items": [
//       { "action": "insert", "key": "animate-hongdae", "fields": { name, addr, ... }, "sources": [{url, fields, checked_at}] },
//       { "action": "update", "key": "...", "shop_id": "<uuid>", "expect_updated_at": "<읽을 때 값>",
//         "fields": { ... }, "overwrite": ["hours"], "reason": "공식 공지 ...", "sources": [...] } ] }
//
// 안전장치
// - 실행 전 shops·places·shop_tags·shop_goods_categories 전체 백업 (scripts/shops/backups/)
// - insert: 이름·주소·공식 링크로 기존 샵(삭제·숨김 포함)과 대조해 중복이면 건너뛴다
// - update: 최신 행을 다시 읽어 expect_updated_at 과 다르면 건너뛴다(다른 작업자 변경 보호).
//           비어 있는 필드만 채우고, 기존 값을 바꾸려면 overwrite 에 필드명을 적어야 한다.
//           addr·lat·lng·place_id 를 바꾸는데 연결된 이벤트가 있으면 건너뛴다(과거 행사 위치 보호).
// - 결과는 scripts/shops/runs/ 에 기록, 샵별 출처·확인일은 scripts/shops/ledger.json 에 누적
//
// 샵 부속 연결 (insert·update 둘 다, 모두 "추가만" — 기존 연결은 지우지 않는다)
//   "works": [{ "tag_id": "<uuid>", "primary": false, "evidence": "..." }]  → shop_tags (기존 작품만. tags 새로 만들지 않음)
//   "goods_types": ["acrylic-stand", ...]                                    → shop_goods_categories (goods_types.slug, is_active)
//   "products": [{ slug|tag_id, goods_type, variant_name, availability:"unknown", evidence, url, date }] → shop_products (옵션, 추가만)
//   "add_custom_goods": ["퍼즐", ...]                                          → shops.custom_goods 에 추가 (목록에 없는 취급 상품)
//   works 는 { "slug": "..." } 로도 적을 수 있다. 목록에 없는 작품은 createWorks.mjs 로 먼저 만든다
//   "link_events": [{ "event_id": "<uuid>", "evidence": "..." }]             → events.shop_id 만 채움
//     · 이벤트의 shop_id 가 비어 있을 때만(다른 샵에 붙은 건 건드리지 않음)
//     · 같은 건물이 아니라 "그 샵" 이어야 함: 도로명주소가 같고 place_detail/place_name 에 샵 이름(지점 포함)이 들어 있어야 함
//       (예: '5층 애니메이트 홍대점' ○ / '5층 애니메이트 카페 홍대점'·'3층 팝업 공간' ✕)
//     · 이벤트 쪽 표기가 다르면 { "event_id", "alias": "애니메이트 수원점" } — 그 샵만 가리키는 표기여야 함(카페·다른 공간 표기 금지)
//     · 다른 샵에 잘못 붙은 것은 { "event_id", "from_shop_id": "<지금 붙은 샵>" } 로 명시할 때만 옮긴다(장소 조건 동일)
//     · 이벤트의 다른 필드는 바꾸지 않는다
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geocode } from './lib-geocode.mjs'

config({ path: '../.env.local', quiet: true })
const require = createRequire(import.meta.url)
const romanize = require('hangul-romanization')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const EDITOR = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const DIR = 'scripts/shops'
const planPath = process.argv[2]
const dry = process.argv.includes('--dry')
if (!planPath) throw new Error('plan path required')
const plan = JSON.parse(await readFile(planPath, 'utf8'))
const now = new Date().toISOString()

async function writeJson(path, data) {
  await writeFile(path + '.tmp', JSON.stringify(data, null, 1))
  await rename(path + '.tmp', path)
}

async function readAll(table, select = '*', order = 'id') {
  const rows = []
  for (let from = 0; ; from += 500) {
    const r = await db.from(table).select(select).order(order).range(from, from + 499)
    if (r.error) throw r.error
    rows.push(...r.data)
    if (r.data.length < 500) break
  }
  return rows
}

const norm = (s) => (s ?? '').toString().toLowerCase().replace(/\s+/g, '').replace(/[()\[\]·・.,'"-]/g, '')
const normUrl = (u) => (u ?? '').toString().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
// "서울 마포구 양화로 188" 수준까지 (도로명+번호)
const roadKey = (a) => {
  const m = (a ?? '').replace(/특별시|광역시|특별자치시|특별자치도/g, '').match(/([가-힣0-9]+(?:로|길)(?:\s?[0-9]+(?:번)?길)?)\s?([0-9]+(?:-[0-9]+)?)/)
  return m ? norm(m[1] + m[2]) : null
}

function slugOf(name) {
  const r = /[가-힣]/.test(name) ? romanize.convert(name) : name
  return r.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `shop-${Math.random().toString(36).slice(2, 8)}`
}

function findDuplicates(all, f) {
  const hits = []
  const n = norm(f.name)
  const rk = roadKey(f.addr)
  const links = [f.shop_link, ...(f.sns_links ?? [])].filter(Boolean).map(normUrl)
  for (const s of all) {
    const reasons = []
    const sn = norm(s.name)
    if (sn === n) reasons.push('same-name')
    const sameRoad = rk && roadKey(s.addr) === rk
    if (sameRoad && (sn.includes(n) || n.includes(sn) || (f.brand && sn.includes(norm(f.brand))))) reasons.push('same-address+similar-name')
    const sLinks = [s.shop_link, ...(s.sns_links ?? [])].filter(Boolean).map(normUrl)
    // 브랜드 공통 링크(본사 사이트)는 지점 구분이 안 되므로, 지점 전용 링크만 비교한다
    const shared = links.filter((l) => sLinks.includes(l) && !(f.brand_links ?? []).map(normUrl).includes(l))
    if (shared.length && sameRoad) reasons.push('same-link+address')
    if (reasons.length) hits.push({ id: s.id, name: s.name, addr: s.addr, status: s.status, reasons })
  }
  return hits
}

// "애니메이트 홍대점" → "애니메이트홍대" (지점 꼬리 '점' 제거 후 공백 없이)
const nameCore = (s) => norm(s).replace(/점$/, '')
// alias: 이벤트 쪽 표기가 샵 이름과 다를 때(예 샵 '애니메이트 ak플라자 수원점' ↔ 이벤트 '5층 애니메이트 수원점')
//        plan 에 그 샵을 가리키는 표기를 적는다. 주소 일치는 그대로 요구한다.
function eventAtShop(ev, shop, alias) {
  const rk = roadKey(shop.addr)
  if (!rk || roadKey(ev.place_addr) !== rk) return false
  const where = norm(`${ev.place_detail ?? ''} ${ev.place_name ?? ''}`)
  if (where.includes(nameCore(shop.name))) return true
  return !!alias && norm(alias).length >= 4 && where.includes(nameCore(alias))
}

// 작품·취급 상품·이벤트 연결 (추가만). out 에 결과를 붙인다.
async function applyExtras(item, shop, out) {
  const extras = {}
  if (item.works?.length) {
    // tag_id 대신 slug 로 적어도 된다 (createWorks.mjs 로 막 만든 작품 등)
    const slugs = item.works.filter((w) => !w.tag_id && w.slug).map((w) => w.slug)
    if (slugs.length) {
      const bs = await db.from('tags').select('id, slug').in('slug', slugs)
      if (bs.error) throw bs.error
      const m = new Map(bs.data.map((t) => [t.slug, t.id]))
      for (const w of item.works) if (!w.tag_id && w.slug) w.tag_id = m.get(w.slug) ?? `slug:${w.slug}`
    }
    const ids = item.works.map((w) => w.tag_id).filter((id) => !id.startsWith('slug:'))
    const tg = await db.from('tags').select('id, name').in('id', ids)
    if (tg.error) throw tg.error
    const known = new Map(tg.data.map((t) => [t.id, t.name]))
    const cur = shop.id ? await db.from('shop_tags').select('tag_id, is_primary').eq('shop_id', shop.id) : { data: [] }
    if (cur.error) throw cur.error
    const have = new Set(cur.data.map((r) => r.tag_id))
    let primaries = cur.data.filter((r) => r.is_primary).length
    const add = [], unknown = []
    for (const w of item.works) {
      if (!known.has(w.tag_id)) { unknown.push(w.tag_id); continue }
      if (have.has(w.tag_id)) continue
      const primary = !!w.primary && primaries < 3
      if (primary) primaries++
      add.push({ shop_id: shop.id, tag_id: w.tag_id, is_primary: primary })
      have.add(w.tag_id)
    }
    if (add.length && !dry) {
      const r = await db.from('shop_tags').insert(add)
      if (r.error) throw r.error
    }
    extras.works = { added: add.map((a) => known.get(a.tag_id)), already: item.works.length - add.length - unknown.length, unknown }
  }
  if (item.goods_types?.length) {
    const gt = await db.from('goods_types').select('id, slug').in('slug', item.goods_types).eq('is_active', true)
    if (gt.error) throw gt.error
    const cur = shop.id ? await db.from('shop_goods_categories').select('goods_type_id').eq('shop_id', shop.id) : { data: [] }
    if (cur.error) throw cur.error
    const have = new Set(cur.data.map((r) => r.goods_type_id))
    const add = gt.data.filter((g) => !have.has(g.id))
    if (add.length && !dry) {
      const r = await db.from('shop_goods_categories').insert(add.map((g) => ({ shop_id: shop.id, goods_type_id: g.id })))
      if (r.error) throw r.error
    }
    const found = new Set(gt.data.map((g) => g.slug))
    extras.goods_types = { added: add.map((g) => g.slug), unknown: item.goods_types.filter((s) => !found.has(s)) }
  }
  // 선택 목록(goods_types)에 없는 취급 상품 → shops.custom_goods 에 추가만 (기존 항목 유지)
  if (item.add_custom_goods?.length && shop.id) {
    const cur = await db.from('shops').select('custom_goods').eq('id', shop.id).single()
    if (cur.error) throw cur.error
    const before = cur.data.custom_goods ?? []
    const add = item.add_custom_goods.filter((g) => !before.includes(g))
    if (add.length && !dry) {
      const after = [...before, ...add]
      const u = await db.from('shops').update({ custom_goods: after }).eq('id', shop.id)
      if (u.error) throw u.error
      await db.from('shop_change_logs').insert({ shop_id: shop.id, target_table: 'shops', field_name: 'custom_goods',
        old_value: before, new_value: after, change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })
    }
    extras.custom_goods = { added: add }
  }
  // 취급 상품 옵션 (shop_products: 작품 × 상품 분류 × 옵션명 + 재고 상태) — 현재 구조 그대로
  //   [{ "tag_id"|"slug", "goods_type": "<slug>", "variant_name": "옵션명|null", "availability": "unknown", "evidence", "url", "date" }]
  //   · 이미 같은 (샵, 작품, 분류, 옵션) 행이 있으면(비활성 포함) 만들지 않는다 — 확인된 변경만 별도 보완
  //   · 재고는 지점의 현재 재고가 공식 확인될 때만 unknown 외 값. 과거 입고 공지만으로는 unknown
  //   · UI 등록 함수와 달리 events(goods_added) 행을 만들지 않는다(이벤트는 다른 담당)
  if (item.products?.length && shop.id) {
    const res = { added: [], exists: [], skipped: [] }
    for (const pr of item.products) {
      let tagId = pr.tag_id
      if (!tagId && pr.slug) tagId = (await db.from('tags').select('id').eq('slug', pr.slug).maybeSingle()).data?.id
      const gt = (await db.from('goods_types').select('id').eq('slug', pr.goods_type).eq('is_active', true).maybeSingle()).data
      if (!tagId || !gt) { res.skipped.push({ ...pr, why: !tagId ? 'work-not-found' : 'goods-type-not-found' }); continue }
      const avail = pr.availability ?? 'unknown'
      if (!['unknown', 'not_sold', 'sold_out', 'few', 'normal', 'many'].includes(avail)) { res.skipped.push({ ...pr, why: 'bad-availability' }); continue }
      const vslug = pr.variant_name ? slugOf(pr.variant_name) : null
      let q = db.from('shop_products').select('id, is_active').eq('shop_id', shop.id).eq('tag_id', tagId).eq('goods_type_id', gt.id)
      q = vslug ? q.eq('variant_slug', vslug) : q.is('variant_slug', null)
      const ex = await q.maybeSingle()
      if (ex.error) throw ex.error
      if (ex.data) { res.exists.push({ ...pr, id: ex.data.id, is_active: ex.data.is_active }); continue }
      if (dry) { res.added.push({ ...pr, dry: true }); continue }
      const ins = await db.from('shop_products').insert({
        shop_id: shop.id, tag_id: tagId, goods_type_id: gt.id, character_id: null,
        variant_name: pr.variant_name ?? null, variant_slug: vslug, availability: avail,
        source: 'admin', confirmed_by_type: 'admin', confirmed_by_user_id: EDITOR,
        last_confirmed_at: pr.date ? new Date(pr.date).toISOString() : now,
      }).select('id').single()
      if (ins.error) throw ins.error
      await db.from('shop_change_logs').insert({ shop_id: shop.id, target_table: 'shop_products', target_id: ins.data.id, field_name: 'availability',
        old_value: null, new_value: avail, change_source: 'admin', changed_by: EDITOR, reason: 'admin_update' })
      res.added.push({ ...pr, id: ins.data.id })
    }
    extras.products = res
  }
  if (item.link_events?.length) {
    const res = { linked: [], skipped: [] }
    for (const le of item.link_events) {
      const ev = await db.from('events').select('id, title, place_name, place_addr, place_detail, shop_id').eq('id', le.event_id).maybeSingle()
      if (ev.error) throw ev.error
      if (!ev.data) { res.skipped.push({ id: le.event_id, why: 'not-found' }); continue }
      if (shop.id && ev.data.shop_id === shop.id) { res.skipped.push({ id: le.event_id, why: 'already-linked' }); continue }
      // 잘못 붙은 연결 바로잡기: from_shop_id 를 명시하고, 이벤트 장소가 이 샵을 가리킬 때만 옮긴다
      const relink = ev.data.shop_id && le.from_shop_id && ev.data.shop_id === le.from_shop_id
      if (ev.data.shop_id && !relink) { res.skipped.push({ id: le.event_id, why: 'linked-to-other-shop', other: ev.data.shop_id }); continue }
      if (!eventAtShop(ev.data, shop, le.alias)) { res.skipped.push({ id: le.event_id, why: 'not-this-shop', place: ev.data.place_detail }); continue }
      if (!dry) {
        const q = db.from('events').update({ shop_id: shop.id, updated_by: EDITOR, updated_at: new Date().toISOString() })
          .eq('id', le.event_id)
        const u = await (relink ? q.eq('shop_id', le.from_shop_id) : q.is('shop_id', null)).select('id')
        if (u.error) throw u.error
        if (!u.data.length) { res.skipped.push({ id: le.event_id, why: 'race' }); continue }
      }
      res.linked.push({ id: le.event_id, title: ev.data.title, ...(relink ? { relinked_from: le.from_shop_id } : {}) })
    }
    extras.link_events = res
  }
  if (Object.keys(extras).length) out.extras = extras
}

// ── 0. 실행 잠금 (이전 실행이 진행 중이면 쓰기 안 함)
await mkdir(`${DIR}/runs`, { recursive: true })
const statePath = `${DIR}/state.json`
const state = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : {}
if (!dry && state.running && Date.now() - Date.parse(state.running.since) < 3 * 3600e3) {
  console.log('이전 실행 진행 중 — 쓰기 중단', state.running)
  process.exit(2)
}
if (!dry) await writeJson(statePath, { ...state, running: { since: now, plan: planPath } })

const result = { plan: plan.name, at: now, dry, items: [] }
try {
  // ── 1. 백업
  const shops = await readAll('shops')
  if (!dry) {
    const places = await readAll('places')
    const shopTags = await readAll('shop_tags', '*', 'shop_id')
    const shopGoods = await readAll('shop_goods_categories', '*', 'shop_id')
    const shopProducts = await readAll('shop_products')
    await mkdir(`${DIR}/backups`, { recursive: true })
    const stamp = now.replaceAll(':', '-').replaceAll('.', '-')
    const file = `${DIR}/backups/shops-before-${plan.name}-${stamp}.json`
    await writeFile(file, JSON.stringify({ shops, places, shopTags, shopGoods, shopProducts }, null, 1))
    result.backup = file
  }

  const ledgerPath = `${DIR}/ledger.json`
  const ledger = existsSync(ledgerPath) ? JSON.parse(await readFile(ledgerPath, 'utf8')) : { shops: {} }

  for (const item of plan.items) {
    const out = { key: item.key, action: item.action }
    result.items.push(out)
    try {
      if (item.action === 'insert') {
        const f = { ...item.fields }
        // 사전 점검: 중복
        const dups = findDuplicates(shops, { ...f, brand: item.brand, brand_links: item.brand_links })
        if (dups.length) { out.status = 'SKIP_DUPLICATE'; out.duplicates = dups; continue }
        // 좌표: 계획에 없으면 카카오 주소 검색
        if ((f.lat == null || f.lng == null) && f.addr) {
          const g = await geocode(f.addr)
          if (!g) { out.status = 'SKIP_NO_GEOCODE'; continue }
          f.lat = g.lat; f.lng = g.lng; out.geocode = g
        }
        const row = {
          ...f,
          status: f.status ?? 'active',
          country: 'KR',
          added_by: EDITOR, owner_id: EDITOR,
          info_last_confirmed_at: now, info_confirmed_by_type: 'admin',
        }
        delete row.brand
        if (dry) { out.status = 'DRY_INSERT'; out.row = row; await applyExtras(item, { id: null, name: row.name, addr: row.addr }, out); continue }
        let saved = null
        const base = item.slug ?? slugOf(f.name)
        for (let i = 1; i <= 8 && !saved; i++) {
          const r = await db.from('shops').insert({ ...row, slug: i === 1 ? base : `${base}-${i}` }).select('id, slug, name').single()
          if (r.data) saved = r.data
          else if (r.error?.code !== '23505') throw r.error
        }
        if (!saved) throw new Error('slug 충돌 반복')
        out.status = 'INSERTED'; out.id = saved.id; out.slug = saved.slug
        shops.push({ ...row, ...saved })
        ledger.shops[saved.id] = {
          name: saved.name, slug: saved.slug, created_by_task: plan.name,
          last_checked_at: now, sources: item.sources ?? [], unconfirmed: item.unconfirmed ?? [],
          photo: item.photo ?? 'needed', notes: item.notes ?? null,
        }
        await applyExtras(item, { id: saved.id, name: saved.name, addr: row.addr }, out)
      } else if (item.action === 'update') {
        const cur = await db.from('shops').select('*').eq('id', item.shop_id).single()
        if (cur.error) throw cur.error
        const row = cur.data
        if (item.expect_updated_at && row.updated_at !== item.expect_updated_at) {
          out.status = 'SKIP_CHANGED_SINCE_READ'; out.db_updated_at = row.updated_at; continue
        }
        const patch = {}
        const overwrite = item.overwrite ?? []
        for (const [k, v] of Object.entries(item.fields ?? {})) {
          const empty = row[k] == null || row[k] === '' || (Array.isArray(row[k]) && row[k].length === 0)
          if (JSON.stringify(row[k]) === JSON.stringify(v)) continue
          if (empty || overwrite.includes(k)) patch[k] = v
        }
        const moves = ['addr', 'lat', 'lng', 'place_id'].filter((k) => k in patch && row[k] != null)
        if (moves.length) {
          const ev = await db.from('events').select('id, title, start_date, end_date').eq('shop_id', row.id)
          if (ev.error) throw ev.error
          if (ev.data.length && !item.allow_location_change) {
            out.status = 'SKIP_LOCATION_HAS_EVENTS'; out.events = ev.data; continue
          }
        }
        if (!Object.keys(patch).length) { out.status = 'NO_CHANGE' }
        else if (dry) { out.status = 'DRY_UPDATE'; out.patch = patch }
        else {
          const u = await db.from('shops').update({ ...patch, info_last_confirmed_at: now, info_confirmed_by_type: 'admin' })
            .eq('id', row.id).eq('updated_at', row.updated_at).select('id, updated_at')
          if (u.error) throw u.error
          if (!u.data.length) { out.status = 'SKIP_RACE'; continue }
          for (const [k, v] of Object.entries(patch)) {
            await db.from('shop_change_logs').insert({
              shop_id: row.id, target_table: 'shops', field_name: k, old_value: row[k] ?? null, new_value: v,
              change_source: 'admin', changed_by: EDITOR, reason: 'admin_update',
            })
          }
          out.status = 'UPDATED'; out.id = row.id; out.patch = patch
          out.before = Object.fromEntries(Object.keys(patch).map((k) => [k, row[k]]))
        }
        await applyExtras(item, row, out)
        if (!dry) {
          const prev = ledger.shops[row.id] ?? { name: row.name, slug: row.slug, sources: [] }
          ledger.shops[row.id] = {
            ...prev, last_checked_at: now,
            sources: [...(prev.sources ?? []), ...(item.sources ?? [])],
            unconfirmed: item.unconfirmed ?? prev.unconfirmed ?? [],
            photo: item.photo ?? prev.photo ?? 'needed', notes: item.notes ?? prev.notes ?? null,
          }
        }
      }
    } catch (e) {
      out.status = 'ERROR'; out.error = e.message ?? String(e)
    }
  }
  if (!dry) await writeJson(ledgerPath, ledger)
} finally {
  const stamp = now.replaceAll(':', '-').replaceAll('.', '-')
  await writeFile(`${DIR}/runs/apply-${plan.name}-${dry ? 'dry-' : ''}${stamp}.json`, JSON.stringify(result, null, 1))
  if (!dry) {
    const s = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : {}
    delete s.running
    await writeJson(statePath, { ...s, last_apply: { at: now, plan: planPath } })
  }
}
console.log(JSON.stringify(result.items.map((i) => ({ key: i.key, status: i.status, id: i.id, slug: i.slug, dups: i.duplicates, err: i.error, patch: i.patch && Object.keys(i.patch), extras: i.extras })), null, 1))
