import { config } from 'dotenv'

config({ path: '../.env.local' })
const key = process.env.KAKAO_REST_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_KEY
if (!key) throw new Error('Kakao REST key missing')

const queries = [
  '삼정타워', 'AK플라자 홍대', '롯데월드 쇼핑몰 서울 송파구 올림픽로 240',
  'LC타워 홍대', '스타시티쇼핑몰', '딜라이트스퀘어 합정', '대림창고',
]

for (const query of queries) {
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
    headers: { Authorization: `KakaoAK ${key}` },
  })
  if (!response.ok) throw new Error(`${query}: ${response.status}`)
  const json = await response.json()
  console.log(JSON.stringify({ query, documents: json.documents.map((row) => ({
    id: row.id,
    name: row.place_name,
    addr: row.road_address_name || row.address_name,
    lat: Number(row.y),
    lng: Number(row.x),
    category_name: row.category_name,
  })) }, null, 2))
}
