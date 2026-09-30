/* 이벤트 여러 건을 한 스크립트에서 등록할 때 쓰는 공용 흐름 (2026-09-21)
 *
 *   const batch = await openBatch(db, { name: 'official-0921-a', editor, titles })
 *     → 제목 접두어가 같은 기존 행을 모아 scripts/event-backups/ 에 백업한다
 *   const { saved } = await batch.saveEvent(event)
 *     → shop_id(findShopId) · series_key(resolveSeriesKey) 를 헬퍼로 정하고,
 *       제목·기간이 같은 기존 행이 있으면 UPDATE, 없으면 INSERT
 *   await batch.addGoods(saved.id, [{ name, kind, price, image }])
 *     → 같은 이름의 굿즈가 있으면 건너뛴다. image 는 uploadEventImage 결과 url
 *
 * shopLookup 을 주면 findShopId 에 그 값을 넘긴다 (템플릿 행 주소가 비어 있거나 지점 힌트가 샵명과 다를 때).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { findShopId } from './findShopId.mjs'
import { resolveSeriesKey } from './seriesKey.mjs'

/** 미리보기 이미지 좌표 [left, top, right, bottom] × 배율 → sharp extract 영역 */
export const box = (scale, [l, t, r, b]) => ({
  left: Math.round(l * scale), top: Math.round(t * scale),
  width: Math.round((r - l) * scale), height: Math.round((b - t) * scale),
})

export async function openBatch(db, { name, editor, titles }) {
  const before = []
  for (const t of titles) {
    const r = await db.from('events').select('*').ilike('title', `${t}%`)
    if (r.error) throw r.error
    before.push(...r.data)
  }
  const goodsBefore = before.length
    ? (await db.from('event_goods').select('*').in('event_id', before.map((e) => e.id))).data ?? []
    : []
  await mkdir('scripts/event-backups', { recursive: true })
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  await writeFile(`scripts/event-backups/before-${name}-${stamp}.json`, JSON.stringify({ events: before, goods: goodsBefore }, null, 2))

  async function saveEvent(input, { shopLookup = null } = {}) {
    const event = { ...input, updated_by: editor, updated_at: new Date().toISOString() }
    event.shop_id = await findShopId(db, shopLookup ?? {
      placeId: event.place_id, addr: event.place_addr, nameHint: event.place_detail || event.place_name,
    })
    if (event.shop_id) Object.assign(event, { place_name: null, place_addr: null, place_lat: null, place_lng: null })
    event.series_key = await resolveSeriesKey(db, { title: event.title, startDate: event.start_date, endDate: event.end_date })

    const existing = before.find((r) => r.title === event.title && r.start_date === event.start_date && r.end_date === event.end_date)
    const saved = existing
      ? await db.from('events').update(event).eq('id', existing.id).select('*').single()
      : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
    if (saved.error) throw saved.error
    return { saved: saved.data, status: existing ? 'UPDATED' : 'INSERTED' }
  }

  async function addGoods(eventId, items) {
    const result = []
    for (const item of items) {
      const dup = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', item.name).eq('is_deleted', false).maybeSingle()
      if (dup.error) throw dup.error
      if (dup.data) { result.push('skip'); continue }
      const ins = await db.from('event_goods').insert({
        event_id: eventId, name: item.name, kind: item.kind ?? 'goods', price: item.price ?? null,
        image_url: item.image ?? null, created_by: editor, updated_by: editor,
      })
      if (ins.error) throw ins.error
      result.push('ok')
    }
    return result
  }

  return { before, saveEvent, addGoods }
}
