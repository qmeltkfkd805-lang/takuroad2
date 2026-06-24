// DB 값 ↔ 사용자 표시 문구 매핑.
// DB는 favorite/interest, planned/... 영문값 유지, 화면 문구는 여기서만 바꾼다.
import { FavoriteTier, RelationshipState } from '@/types/work-relationship'

export const AFFINITY_LABEL: Record<FavoriteTier, { icon: string; label: string }> = {
  favorite: { icon: '❤️', label: '최애' },
  interest: { icon: '⭐', label: '좋아하는 작품' },
}

export const STATE_LABEL: Record<RelationshipState, { icon: string; label: string }> = {
  planned:     { icon: '👀', label: '볼 예정' },
  in_progress: { icon: '▶️', label: '보는 중' },
  completed:   { icon: '✅', label: '완료' },
  paused:      { icon: '⏸️', label: '보류' },
}