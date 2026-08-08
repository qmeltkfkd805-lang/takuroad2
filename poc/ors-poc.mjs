#!/usr/bin/env node
/*
 * 타쿠로드 도보 경로 PoC — OpenRouteService(foot-walking) 실측 스크립트
 *
 * 사용법:
 *   1) openrouteservice.org 무료 가입 후 API 키 발급
 *   2) export-routes.sql 로 뽑은 루트 데이터를 이 폴더에 poc-routes.json 으로 저장
 *   3) 실행:
 *        ORS_API_KEY=발급받은키 node ors-poc.mjs
 *      (TMap 비교까지 하려면)  TMAP_APP_KEY=... 도 함께 지정
 *
 * 입력  poc-routes.json  형식:
 *   [
 *     { "id": "uuid", "title": "홍대 굿즈 투어", "region": "홍대",
 *       "stops": [ { "name": "샵A", "lat": 37.55, "lng": 126.92 }, ... ] },
 *     ...
 *   ]
 *
 * 출력:
 *   poc-results.json    루트별 원자료(geometry/거리/시간/지연/에러)
 *   poc-report.html     지도 검수 뷰어(OSM 타일, 키 불필요) — 브라우저로 열기
 *   poc-이상사례.md      이상 사례 기록용 표(수기 작성)
 *
 * 주의: ORS는 좌표를 [경도(lng), 위도(lat)] 순서로 받는다. 카카오/보통 표기와 반대.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const ORS_API_KEY = process.env.ORS_API_KEY
const TMAP_APP_KEY = process.env.TMAP_APP_KEY || null
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson'
const TMAP_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian'
const MAX_WAYPOINTS = 50          // ORS 경유지(점) 한도
const TMAP_MAX_POINTS = 7         // TMap: 출발+경유5+도착 = 7점/콜
const CALL_DELAY_MS = 1600        // ORS free 40건/분 → 여유있게 간격

if (!ORS_API_KEY) { console.error('환경변수 ORS_API_KEY 가 필요합니다.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))

function haversine(a, b) {
  const R = 6371000, toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
function straightTotal(stops) {
  let t = 0
  for (let i = 1; i < stops.length; i++) t += haversine(stops[i - 1], stops[i])
  return Math.round(t)
}
// 50점 초과 시 50점 윈도우(경계 1점 겹침)로 분할
function chunkWaypoints(points, size) {
  if (points.length <= size) return [points]
  const chunks = []
  for (let i = 0; i < points.length - 1; i += size - 1) chunks.push(points.slice(i, i + size))
  return chunks
}

async function orsSegment(points) {
  const body = { coordinates: points.map(p => [p.lng, p.lat]), instructions: false }
  const started = Date.now()
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: ORS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify(body),
  })
  const latency = Date.now() - started
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j?.error?.message || JSON.stringify(j?.error) || msg } catch {}
    return { ok: false, latency, error: msg }
  }
  const gj = await res.json()
  const f = gj?.features?.[0]
  if (!f) return { ok: false, latency, error: 'no feature' }
  return {
    ok: true, latency,
    coords: f.geometry.coordinates,                 // [[lng,lat], ...]
    distance: Math.round(f.properties?.summary?.distance ?? 0),
    duration: Math.round((f.properties?.summary?.duration ?? 0) / 60),
    attribution: gj?.metadata?.attribution ?? null,
  }
}

// 연속 동일 좌표(같은 건물 내 여러 샵) 합치기 — 길이 0 구간 방지
function collapseConsecutive(points) {
  const out = []
  for (const s of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.lat - s.lat) < 1e-6 && Math.abs(last.lng - s.lng) < 1e-6) continue
    out.push(s)
  }
  return out
}

async function runOrs(stops) {
  const valid = stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
  const missing = stops.length - valid.length
  const routed = collapseConsecutive(valid)           // 라우팅용(중복 좌표 제거)
  const collapsed = valid.length - routed.length       // 합쳐진 스팟 수
  if (routed.length < 2) {
    // 유효 좌표가 1개(또는 전부 같은 위치) → 걸어갈 경로 없음
    return { status: 'insufficient', reason: valid.length ? 'single_location' : 'no_coords',
      missing, collapsed, geometry: [], distance_m: null, duration_min: null }
  }

  const chunks = chunkWaypoints(routed, MAX_WAYPOINTS)
  let geometry = [], distance = 0, duration = 0, attribution = null
  const failedChunks = []
  let maxLatency = 0

  for (let c = 0; c < chunks.length; c++) {
    const r = await orsSegment(chunks[c])
    maxLatency = Math.max(maxLatency, r.latency || 0)
    if (!r.ok) { failedChunks.push({ chunk: c, error: r.error }); if (c < chunks.length - 1) await sleep(CALL_DELAY_MS); continue }
    const seg = c === 0 ? r.coords : r.coords.slice(1)   // 조인점 중복 제거
    geometry = geometry.concat(seg)
    distance += r.distance; duration += r.duration
    attribution = attribution || r.attribution
    if (c < chunks.length - 1) await sleep(CALL_DELAY_MS)
  }

  const status = failedChunks.length === 0 ? 'ok' : (geometry.length ? 'partial' : 'failed')
  return {
    status, missing, collapsed, geometry, attribution,
    distance_m: geometry.length ? distance : null,
    duration_min: geometry.length ? duration : null,
    failed_chunks: failedChunks, latency_ms: maxLatency, calls: chunks.length,
  }
}

// (선택) TMap 비교 — 품질 확인용. 2점씩 이어붙여 대략적 경로만 취득.
async function runTmap(stops) {
  if (!TMAP_APP_KEY) return null
  const valid = collapseConsecutive(stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number'))
  if (valid.length < 2) return { status: 'insufficient', geometry: [] }
  let geometry = [], distance = 0, duration = 0, failed = 0
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1], b = valid[i]
    try {
      const res = await fetch(TMAP_URL, {
        method: 'POST',
        headers: { appKey: TMAP_APP_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startX: a.lng, startY: a.lat, endX: b.lng, endY: b.lat,
          startName: encodeURIComponent(a.name || 'start'), endName: encodeURIComponent(b.name || 'end'),
          reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
        }),
      })
      const j = await res.json()
      for (const ft of j.features || []) {
        if (ft.geometry?.type === 'LineString') geometry = geometry.concat(ft.geometry.coordinates)
        if (ft.properties?.totalDistance) distance += ft.properties.totalDistance
        if (ft.properties?.totalTime) duration += ft.properties.totalTime
      }
    } catch { failed++ }
    await sleep(CALL_DELAY_MS)
  }
  return { status: failed ? 'partial' : 'ok', geometry, distance_m: Math.round(distance), duration_min: Math.round(duration / 60), failed_segments: failed }
}

async function main() {
  let routes
  try { routes = JSON.parse(readFileSync(new URL('./poc-routes.json', import.meta.url))) }
  catch { console.error('poc-routes.json 을 찾을 수 없습니다. export-routes.sql 결과를 저장하세요.'); process.exit(1) }

  const results = []
  for (const [i, route] of routes.entries()) {
    process.stdout.write(`[${i + 1}/${routes.length}] ${route.region} · ${route.title} (${route.stops.length}스팟) ... `)
    const ors = await runOrs(route.stops)
    const tmap = await runTmap(route.stops)
    const straight = straightTotal(route.stops.filter(s => s.lat && s.lng))
    results.push({ ...route, straight_m: straight, ors, tmap })
    console.log(`ORS=${ors.status} ${ors.distance_m ?? '-'}m / 직선 ${straight}m${tmap ? ` · TMap=${tmap.status}` : ''}`)
    await sleep(CALL_DELAY_MS)
  }

  writeFileSync(new URL('./poc-results.json', import.meta.url), JSON.stringify(results, null, 2))
  writeFileSync(new URL('./poc-report.html', import.meta.url), buildHtml(results))
  writeFileSync(new URL('./poc-이상사례.md', import.meta.url), buildNotes(results))

  const ok = results.filter(r => r.ors.status === 'ok').length
  const partial = results.filter(r => r.ors.status === 'partial').length
  const bad = results.filter(r => ['failed', 'insufficient'].includes(r.ors.status)).length
  console.log(`\n완료: ORS 성공 ${ok} · 부분 ${partial} · 실패/부족 ${bad}`)
  console.log('poc-report.html 을 브라우저로 열어 경로를 육안 검수하고, poc-이상사례.md 에 기록하세요.')
}

function buildNotes(results) {
  const rows = results.map((r, i) =>
    `| ${i + 1} | ${r.region} | ${r.title} | ${r.stops.length} | ${r.ors.status} | ${r.ors.distance_m ?? '-'} | ${r.straight_m} | ${r.ors.distance_m ? (r.ors.distance_m / r.straight_m).toFixed(2) : '-'} | | |`
  ).join('\n')
  return `# ORS 도보 경로 PoC — 이상 사례 기록

검수 방법: poc-report.html 을 열고 각 루트를 선택해 ORS 실선 경로를 OSM 지도 위에서 확인.
이상 유형 예: 건물 관통 / 골목 누락·우회 / 횡단보도 무시 / 강·철로·대로 비정상 횡단 / 스팟 스냅 실패.

| # | 지역 | 루트 | 스팟 | ORS상태 | ORS(m) | 직선(m) | 배율 | 이상유형 | 메모 |
|---|---|---|---|---|---|---|---|---|---|
${rows}

## 지역별 요약(작성)
- 수원:
- 홍대:
- 용산:

## 종합 판단
- ORS 품질 Go/No-Go:
- TMap 대비 격차가 큰 구간:
`
}

function buildHtml(results) {
  const data = JSON.stringify(results).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>타쿠로드 ORS 도보경로 PoC 검수</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  body{margin:0;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;display:flex;height:100vh}
  #side{width:340px;flex-shrink:0;overflow-y:auto;border-right:1px solid #e5e7eb;padding:14px}
  #map{flex:1}
  h1{font-size:15px;margin:0 0 10px}
  select{width:100%;padding:8px;font-size:13px;margin-bottom:12px}
  .m{font-size:12.5px;line-height:1.7;color:#333}
  .m b{color:#111}
  .tag{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;font-weight:700;color:#fff}
  .ok{background:#16a34a}.partial{background:#d97706}.failed{background:#dc2626}.insufficient{background:#6b7280}
  .lg{font-size:11px;color:#666;margin-top:10px;border-top:1px solid #eee;padding-top:8px}
  .lg span{display:inline-block;width:22px;height:0;border-top:3px solid;vertical-align:middle;margin-right:5px}
  textarea{width:100%;height:90px;margin-top:8px;font-family:inherit;font-size:12px;padding:6px}
  .attr{font-size:10px;color:#888;margin-top:8px}
</style></head><body>
<div id="side">
  <h1>ORS 도보경로 PoC 검수</h1>
  <select id="sel"></select>
  <div class="m" id="meta"></div>
  <div class="lg"><span style="border-color:#e8006f"></span>ORS 실제 경로<br>
  <span style="border-color:#9ca3af;border-top-style:dashed"></span>직선(참고)</div>
  <textarea id="note" placeholder="이상 사례 메모 (건물 관통/골목/횡단보도 등)"></textarea>
  <div class="attr">© openrouteservice.org by HeiGIT | © OpenStreetMap contributors</div>
</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const DATA = ${data};
const map = L.map('map').setView([37.55,126.92],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
let layers=[];
function clear(){layers.forEach(l=>map.removeLayer(l));layers=[]}
function show(idx){
  clear();
  const r=DATA[idx];
  const stops=r.stops.filter(s=>s.lat&&s.lng);
  // 직선(참고)
  if(stops.length>1){
    const ln=L.polyline(stops.map(s=>[s.lat,s.lng]),{color:'#9ca3af',weight:2,dashArray:'6,6'}).addTo(map);layers.push(ln);
  }
  // ORS 실제 경로 [lng,lat]->[lat,lng]
  const g=r.ors.geometry||[];
  if(g.length){
    const pl=L.polyline(g.map(c=>[c[1],c[0]]),{color:'#e8006f',weight:5,opacity:.95}).addTo(map);layers.push(pl);
    map.fitBounds(pl.getBounds(),{padding:[40,40]});
  } else if(stops.length){
    map.fitBounds(L.latLngBounds(stops.map(s=>[s.lat,s.lng])),{padding:[40,40]});
  }
  // 번호 핀
  stops.forEach((s,i)=>{
    const ic=L.divIcon({className:'',html:'<div style="width:26px;height:26px;border-radius:50%;background:#e8006f;border:2px solid #fff;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4)">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]});
    const mk=L.marker([s.lat,s.lng],{icon:ic}).addTo(map).bindPopup((i+1)+'. '+(s.name||''));layers.push(mk);
  });
  const st=r.ors.status;
  const ratio=r.ors.distance_m?(r.ors.distance_m/r.straight_m).toFixed(2):'-';
  document.getElementById('meta').innerHTML=
    '<b>'+r.region+' · '+r.title+'</b><br>'+
    '스팟 '+r.stops.length+'개'+(r.ors.missing?(' (좌표누락 '+r.ors.missing+')'):'')+'<br>'+
    '상태 <span class="tag '+st+'">'+st+'</span><br>'+
    'ORS 거리 <b>'+(r.ors.distance_m??'-')+'m</b> / 직선 '+r.straight_m+'m (배율 '+ratio+')<br>'+
    'ORS 시간 <b>'+(r.ors.duration_min??'-')+'분</b> · 호출 '+(r.ors.calls||1)+'회 · 지연 '+(r.ors.latency_ms||0)+'ms'+
    (r.ors.failed_chunks&&r.ors.failed_chunks.length?('<br>실패청크: '+JSON.stringify(r.ors.failed_chunks)):'')+
    (r.tmap?('<br>TMap: '+r.tmap.status+' '+(r.tmap.distance_m??'-')+'m'):'');
}
const sel=document.getElementById('sel');
DATA.forEach((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. ['+r.region+'] '+r.title+' — '+r.ors.status;sel.appendChild(o)});
sel.addEventListener('change',e=>show(+e.target.value));
show(0);
</script></body></html>`
}

main().catch(e => { console.error(e); process.exit(1) })
