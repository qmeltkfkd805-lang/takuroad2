/* 샵 목록 순서 — 사진이 등록된 샵을 앞으로.
   정보가 채워진 샵이 먼저 보여야 목록이 풍성해 보인다.
   안정 정렬이라 사진 있는 샵끼리·없는 샵끼리는 원래 순서(최신순·거리순 등)를 그대로 지킨다. */

type WithImages = { images?: string[] | null }

export function hasShopImage(s: WithImages): boolean {
  return Array.isArray(s.images) && s.images.length > 0 && !!s.images[0]
}

export function imagesFirst<T extends WithImages>(shops: T[]): T[] {
  const withImg: T[] = []
  const without: T[] = []
  for (const s of shops) (hasShopImage(s) ? withImg : without).push(s)
  return withImg.concat(without)
}
