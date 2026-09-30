// 카카오 로컬 주소 검색으로 도로명 주소 → 좌표. 키는 .env.local 에서 읽고 출력하지 않는다.
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
export async function geocode(addr) {
  const r = await fetch('https://dapi.kakao.com/v2/local/search/address.json?query=' + encodeURIComponent(addr), {
    headers: { Authorization: 'KakaoAK ' + process.env.NEXT_PUBLIC_KAKAO_REST_KEY },
  })
  if (!r.ok) throw new Error('kakao ' + r.status)
  const j = await r.json()
  const d = j.documents?.[0]
  if (!d) return null
  return { lat: Number(d.y), lng: Number(d.x), road: d.road_address?.address_name ?? null, building: d.road_address?.building_name ?? null, count: j.documents.length }
}
if (process.argv[1].endsWith('lib-geocode.mjs')) console.log(await geocode(process.argv[2]))
