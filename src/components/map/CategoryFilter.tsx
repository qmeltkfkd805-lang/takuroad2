'use client'
import { useRef, useState, useEffect } from 'react'
import { CATEGORIES } from '@/lib/constants/categories'
import styles from './CategoryFilter.module.css'

interface CategoryFilterProps {
  selected: string
  onChange: (cat: string) => void
  regions: string[]
  districtsByRegion: Record<string, string[]>
  selectedRegion: string
  selectedDistrict: string
  onChangeRegion: (region: string) => void
  onChangeDistrict: (district: string) => void
}

// 라인아트 아이콘을 mask로 색칠 (선택=흰색, 비선택=카테고리색)
function CatIcon({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{
        width: 16, height: 16, display: 'inline-block', flexShrink: 0,
        backgroundColor: color,
        WebkitMaskImage: `url(/icons/${name}.png)`,
        maskImage: `url(/icons/${name}.png)`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskPosition: 'center', maskPosition: 'center',
      }}
    />
  )
}

export default function CategoryFilter({
  selected,
  onChange,
  regions,
  districtsByRegion,
  selectedRegion,
  selectedDistrict,
  onChangeRegion,
  onChangeDistrict,
}: CategoryFilterProps) {
  const isAll = selected === '전체'
  const regionOn = selectedRegion !== '전체'
  const districtOn = selectedDistrict !== '전체'

  // 마우스로 칩 영역 드래그 스크롤
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    drag.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el || !drag.current.down) return
    const dx = e.pageX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.startScroll - dx
  }
  const endDrag = () => { drag.current.down = false }
  // 드래그였으면 칩 클릭(카테고리 선택) 무시
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) { e.preventDefault(); e.stopPropagation() }
  }

  // 지역 드롭다운
  const [open, setOpen] = useState(false)
  // 패널 안에서 보고 있는 시/도 (선택 전에도 구 목록을 미리 볼 수 있게)
  const [viewRegion, setViewRegion] = useState<string>(regionOn ? selectedRegion : '')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setViewRegion(regionOn ? selectedRegion : '')
  }, [open, regionOn, selectedRegion])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pickRegion = (region: string) => {
    if (region === '전체') { onChangeRegion('전체'); setOpen(false); return }
    setViewRegion(region)
    onChangeRegion(region)   // 시/도 단계에서 이미 지도 이동 + 필터 적용
  }
  const pickDistrict = (district: string) => {
    onChangeDistrict(district)
    setOpen(false)
  }

  const label = !regionOn ? '지역' : districtOn ? `${selectedRegion} ${selectedDistrict}` : selectedRegion
  const districts = viewRegion ? (districtsByRegion[viewRegion] ?? []) : []

  // 항목이 3개를 넘으면 그 이상은 스크롤 (반 줄 살짝 보이게 해서 더 있다는 신호)
  const ROW = 36, GAP = 4, PAD = 6, PEEK = 14
  // rows = 항상 보여줄 줄 수 ('전체' 줄 포함)
  const scrollBox = (items: number, rows: number) =>
    items > 3
      ? { maxHeight: PAD * 2 + (ROW + GAP) * rows + PEEK, overflowY: 'auto' as const, scrollbarWidth: 'thin' as const }
      : {}
  const regionBoxStyle = scrollBox(regions.length - 1, 4)   // '전체' + 시/도 3개
  const districtBoxStyle = scrollBox(districts.length, 4)   // '○○ 전체' + 구 3개

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {/* 칩 가로 스크롤 (마우스 드래그 가능) */}
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={onClickCapture}
        style={{
          display: 'flex', gap: '6px', overflowX: 'auto',
          padding: '8px 12px', scrollbarWidth: 'none', flex: 1, minWidth: 0,
          cursor: 'grab', userSelect: 'none',
        }}
      >
        {/* 전체 */}
        <button
          onClick={() => onChange('전체')}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 13px', borderRadius: '20px',
            border: `1.5px solid ${isAll ? 'var(--accent)' : 'var(--border)'}`,
            background: isAll ? 'var(--accent)' : 'var(--surface)',
            color: isAll ? '#fff' : 'var(--text)',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          <CatIcon name="shop" color={isAll ? '#fff' : 'var(--muted)'} />
          전체
        </button>

        {CATEGORIES.map(cat => {
          const on = selected === cat.name
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 13px', borderRadius: '20px',
                border: `1.5px solid ${on ? cat.color : 'var(--border)'}`,
                background: on ? cat.color : 'var(--surface)',
                color: on ? '#fff' : 'var(--text)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              <CatIcon name={cat.icon} color={on ? '#fff' : cat.color} />
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* 오른쪽 필터 버튼 → 지역 드롭다운 (좁으면 동그란 아이콘만) */}
      <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className={styles.filterBtn}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={regionOn ? `지역: ${label}` : '지역 필터'}
          style={regionOn ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ color: regionOn ? 'var(--accent)' : 'var(--muted)' }}>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          <span className={styles.filterLabel}>{label}</span>
          <svg className={styles.filterChevron} width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: regionOn ? 'var(--accent)' : 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {/* 좁은 화면: 라벨이 숨겨지므로 선택 표시용 점 */}
          {regionOn && <span className={styles.filterDot} />}
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="지역 선택"
            style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 200,
              width: 'min(320px, calc(100vw - 32px))',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, boxShadow: '0 10px 28px rgba(0,0,0,.16)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px 10px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>지역</span>
              {regionOn && (
                <button
                  onClick={() => { onChangeRegion('전체'); setOpen(false) }}
                  style={{
                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                  }}
                >
                  초기화
                </button>
              )}
            </div>

            {regions.length <= 1 ? (
              <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                아직 지역을 알 수 있는 샵이 없어요.<br />샵에 주소를 입력하면 자동으로 나뉩니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr' }}>
                {/* 왼쪽: 시/도 */}
                <div style={{ borderRight: '1px solid var(--border)', padding: PAD, ...regionBoxStyle }}>
                  {regions.map(r => {
                    const viewing = r === '전체' ? !regionOn : viewRegion === r
                    return (
                      <button
                        key={r}
                        onClick={() => pickRegion(r)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 10px', marginBottom: GAP, borderRadius: 9, border: 'none',
                          background: viewing ? 'var(--accent-l)' : 'transparent',
                          color: viewing ? 'var(--accent)' : 'var(--text)',
                          fontSize: 12.5, fontWeight: viewing ? 800 : 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>

                {/* 오른쪽: 구/군 */}
                <div style={{ padding: PAD, ...districtBoxStyle }}>
                  {!viewRegion ? (
                    <div style={{ padding: '14px 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                      왼쪽에서 시/도를 먼저 고르세요.
                    </div>
                  ) : districts.length === 0 ? (
                    <div style={{ padding: '14px 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                      {viewRegion}에는 구·군 정보가 없어요.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                      <button
                        onClick={() => pickDistrict('전체')}
                        style={{
                          padding: '9px 10px', borderRadius: 9,
                          border: `1.5px solid ${!districtOn && viewRegion === selectedRegion ? 'var(--accent)' : 'var(--border)'}`,
                          background: !districtOn && viewRegion === selectedRegion ? 'var(--accent-l)' : 'var(--surface)',
                          color: !districtOn && viewRegion === selectedRegion ? 'var(--accent)' : 'var(--text)',
                          fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', textAlign: 'left', flexShrink: 0,
                        }}
                      >
                        {viewRegion} 전체
                      </button>
                      {districts.map(d => {
                        const on = viewRegion === selectedRegion && selectedDistrict === d
                        return (
                          <button
                            key={d}
                            onClick={() => pickDistrict(d)}
                            style={{
                              padding: '9px 10px', borderRadius: 9,
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                              background: on ? 'var(--accent-l)' : 'var(--surface)',
                              color: on ? 'var(--accent)' : 'var(--text)',
                              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                              fontFamily: 'inherit', textAlign: 'left', flexShrink: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
