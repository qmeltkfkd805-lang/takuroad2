// Work Relationship — 사용자와 작품의 관계 (v2 핵심 도메인 모델)
// 세 축을 하나로 합친 도메인 객체.
//   - Affinity (관계 강도)  → user_favorite_tags
//   - State    (관계 상태)  → user_library
//   - Activity (관계 활동)  → user_tag_collections

export type FavoriteTier = 'favorite' | 'interest'

export type RelationshipState = 'planned' | 'in_progress' | 'completed' | 'paused'

export interface WorkRef {
  id: string
  name: string
  slug: string
}

export interface RelationshipActivity {
  visitCount: number
  collectedAt: string
}

export interface WorkRelationship {
  work: WorkRef
  affinity: FavoriteTier | null
  state: RelationshipState | null
  activity: RelationshipActivity | null
}