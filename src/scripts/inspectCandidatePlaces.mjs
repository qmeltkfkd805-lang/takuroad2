const key = process.env.KAKAO_REST_KEY || process.env.NEXT_PUBLIC_KAKAO_REST_KEY
if (!key) throw new Error('Kakao REST key missing')

for (const query of ['롯데월드몰', '더현대 서울', '무신사 스토어 성수', '아이파크몰 용산점', '신세계백화점 강남점', '서브스트릿 신촌']) {
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
