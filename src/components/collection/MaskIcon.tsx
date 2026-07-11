'use client'

/* ============================================================
   MaskIcon — public/icons/*.png (라인아트, 투명) 을 원하는 색으로 칠해서 쓴다.

   ⭐ 아이콘은 새로 그리지 않는다. 이미 만들어둔 자산을 쓴다.
      손으로 그린 SVG는 자산과 선 두께·비율·성격이 안 맞아서 UI가 튄다.

   방법: backgroundColor + mask-image (프로젝트에서 이미 CategoryFilter·지도 마커가 쓰는 방식)
   컬러 아이콘(color*.png)은 칠할 필요가 없으므로 TDS Icon(<img>)을 쓸 것.
   ============================================================ */

interface Props {
  /** public/icons/{name}.png */
  name: string
  size?: number
  color?: string
  className?: string
}

export function MaskIcon({ name, size = 16, color = 'var(--accent)', className }: Props) {
  const url = `url(/icons/${name}.png)`
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

export default MaskIcon
