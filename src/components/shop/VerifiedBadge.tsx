interface Props {
  size?: number
  color?: string
  className?: string
}

/** 사장님 인증 매장 표시 — 꽃 모양 안에 체크 */
export default function VerifiedBadge({ size = 16, color = 'var(--accent)', className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="인증된 사장님"
      className={className}
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
    >
      <title>인증된 사장님</title>
      <polygon
        points="12.00,1.80 9.65,4.77 6.00,3.75 5.85,7.53 2.30,8.85 4.40,12.00 2.30,15.15 5.85,16.47 6.00,20.25 9.65,19.23 12.00,22.20 14.35,19.23 18.00,20.25 18.15,16.47 21.70,15.15 19.60,12.00 21.70,8.85 18.15,7.53 18.00,3.75 14.35,4.77"
        fill={color}
        stroke={color}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path d="M8.2 12.2l2.6 2.6 5-5.2" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}