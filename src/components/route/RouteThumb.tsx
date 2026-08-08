'use client'
/* 루트 카드 썸네일 스위치.
   USE_PIN_PREVIEW = true  → 경량 SVG 핀 미리보기 (카카오 로고 없음)
   USE_PIN_PREVIEW = false → 실제 카카오 지도(RouteMapThumb)로 복귀
   ※ 이 한 줄만 바꾸면 홈·목록 카드/레일/히어로 썸네일이 전부 원복된다.
   ※ 루트 상세·지도 보기 화면은 항상 실제 카카오 지도를 사용(여기서 다루지 않음). */
import RouteMapThumb from '@/components/profile/RouteMapThumb'
import RoutePinPreview from './RoutePinPreview'

export const USE_PIN_PREVIEW = false

type Stop = { lat: number; lng: number }

export default function RouteThumb({ stops, height = 118, labels, showEnds }: { stops: Stop[]; height?: number; labels?: string[]; showEnds?: boolean }) {
  return USE_PIN_PREVIEW
    ? <RoutePinPreview stops={stops} height={height} />
    : <RouteMapThumb stops={stops} height={height} labels={labels} showEnds={showEnds} />
}
