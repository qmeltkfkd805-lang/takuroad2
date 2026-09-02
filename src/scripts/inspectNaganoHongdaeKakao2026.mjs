import { config } from 'dotenv'

config({ path: '../.env.local' })
const key = process.env.NEXT_PUBLIC_KAKAO_REST_KEY
for (const query of ['0% SEOUL', '서울 마포구 월드컵북로2길 29']) {
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
    headers: { Authorization: `KakaoAK ${key}` },
  })
  const json = await response.json()
  console.log(`\n## ${query}\n${JSON.stringify(json.documents, null, 2)}`)
}
