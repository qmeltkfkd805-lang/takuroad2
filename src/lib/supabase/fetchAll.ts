/* Supabase 한 번 조회는 최대 1,000줄까지만 돌려준다(프로젝트 설정 max rows).
   그래서 "전체 샵"처럼 1,000줄을 넘을 수 있는 목록을 그냥 select 하면 1,000번째 뒤는 말없이 잘린다.
   (실제로 운영 중인 샵이 1,000곳을 넘으면서 지도·샵 목록에 일부 샵이 빠지고 있었다)

   fetchAllRows 는 1,000줄씩 나눠 끝까지 받아 이어 붙인다.
   - build(from, to) 는 매번 새 쿼리를 만들어 .range(from, to) 까지 붙여 돌려줘야 한다.
   - 나눠 받는 동안 순서가 바뀌지 않게, 쿼리에 겹치지 않는 정렬(id 등)을 꼭 넣을 것.
   - 실패하면 그때까지 받은 것과 오류를 같이 돌려준다(부르는 쪽이 예전처럼 처리). */
type PageResult<T> = { data: T[] | null; error: any }

export const PAGE_SIZE = 1000

export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  maxPages = 50,
): Promise<{ data: T[]; error: any }> {
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) return { data: all, error }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return { data: all, error: null }
}
