'use client'

import { useEffect, useRef, useState } from 'react'
import {
  searchPlaces, getPlaceShops, createPlace,
  PlaceSuggestion, PlaceType, PLACE_TYPE_LABEL,
} from '@/services/placeService'
import styles from './PlaceSelectStep.module.css'

const TYPE_ICON: Record<PlaceType, string> = {
  SHOPPING_MALL: '🏢', DEPARTMENT_STORE: '🏬', EXHIBITION: '🏛',
  EVENT_HALL: '🎪', CULTURE_SPACE: '🎭',
}

interface Props {
  /** 장소 선택됨 — 주소·좌표·지역·주차가 자동으로 폼에 들어간다 */
  onSelect: (place: PlaceSuggestion) => void
  /** 장소 없이 진행 (기존 방식: 주소 직접 입력) */
  onSkip: () => void
  selectedPlaceId: string | null
}

export default function PlaceSelectStep({ onSelect, onSkip, selectedPlaceId }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // 선택된 장소의 입점 샵 (중복 등록 방지)
  const [placeShops, setPlaceShops] = useState<{ name: string; floor: string | null }[]>([])
  const selected = results.find(p => p.id === selectedPlaceId) ?? null

  // 자동완성 — 입력 멈추면 300ms 뒤 검색
  const timer = useRef<any>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length === 0) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const r = await searchPlaces(query)
      setResults(r)
      setSearching(false)
    }, 300)
    return () => timer.current && clearTimeout(timer.current)
  }, [query])

  async function pick(place: PlaceSuggestion) {
    onSelect(place)
    const shops = await getPlaceShops(place.id)
    setPlaceShops(shops)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2>어디에 있는 샵인가요?</h2>
        <p>장소를 선택하면 주소·지역·주차 정보가 자동으로 채워져요.</p>
      </div>

      <input
        className={styles.search}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="장소 검색 (예: 스타필드, AK플라자, 코엑스)"
        autoFocus
      />

      {/* 선택된 장소 + 이미 등록된 샵 */}
      {selected && (
        <div className={styles.selectedCard}>
          <div className={styles.selectedTop}>
            <span className={styles.selIcon}>{TYPE_ICON[selected.placeType]}</span>
            <div>
              <div className={styles.selName}>{selected.name} <span className={styles.selBadge}>선택됨</span></div>
              <div className={styles.selAddr}>{selected.addr}</div>
            </div>
          </div>

          {placeShops.length > 0 && (
            <div className={styles.existing}>
              <div className={styles.existingLabel}>이미 등록된 샵 {placeShops.length}곳</div>
              <div className={styles.existingList}>
                {placeShops.map((s, i) => (
                  <span key={i} className={styles.existingChip}>
                    ✓ {s.name}{s.floor ? ` (${s.floor})` : ''}
                  </span>
                ))}
              </div>
              <p className={styles.existingHint}>중복 등록이 아닌지 확인해주세요.</p>
            </div>
          )}
        </div>
      )}

      {/* 검색 결과 */}
      {query.trim() && !selected && (
        <div className={styles.results}>
          {searching ? (
            <div className={styles.hint}>검색 중…</div>
          ) : results.length === 0 ? (
            <div className={styles.noResult}>
              <p>‘{query}’ 장소를 찾지 못했어요.</p>
              <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ 새 장소 등록하기</button>
            </div>
          ) : (
            <>
              {results.map(p => (
                <button key={p.id} className={styles.resultRow} onClick={() => pick(p)}>
                  <span className={styles.rowIcon}>{TYPE_ICON[p.placeType]}</span>
                  <span className={styles.rowInfo}>
                    <span className={styles.rowName}>{p.name}</span>
                    <span className={styles.rowMeta}>
                      {PLACE_TYPE_LABEL[p.placeType]}
                      {p.addr && ` · ${p.addr}`}
                      {p.shopCount > 0 && ` · 입점 ${p.shopCount}`}
                    </span>
                  </span>
                </button>
              ))}
              <button className={styles.createBtnGhost} onClick={() => setShowCreate(true)}>
                + 찾는 장소가 없어요
              </button>
            </>
          )}
        </div>
      )}

      {/* 장소 없이 진행 */}
      <button className={styles.skip} onClick={onSkip}>
        건물·장소에 속하지 않은 독립 매장이에요 (주소 직접 입력)
      </button>

      {showCreate && (
        <CreatePlaceModal
          initialName={query}
          onClose={() => setShowCreate(false)}
          onCreated={p => { setShowCreate(false); pick(p) }}
        />
      )}
    </div>
  )
}

/* ── 새 장소 등록 모달 ── */
function CreatePlaceModal({
  initialName, onClose, onCreated,
}: {
  initialName: string
  onClose: () => void
  onCreated: (p: PlaceSuggestion) => void
}) {
  const [name, setName] = useState(initialName)
  const [addr, setAddr] = useState('')
  const [type, setType] = useState<PlaceType>('SHOPPING_MALL')
  const [saving, setSaving] = useState(false)

  const TYPES: PlaceType[] = ['SHOPPING_MALL', 'DEPARTMENT_STORE', 'EXHIBITION', 'EVENT_HALL', 'CULTURE_SPACE']

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    const created = await createPlace({
      name, addr: addr.trim() || null,
      region: null, district: null, lat: null, lng: null,
      placeType: type,
    })
    setSaving(false)
    if (created) onCreated(created)
  }

  return (
    <div className={styles.modalScrim} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>새 장소 등록</h3>
        <label className={styles.mLabel}>장소명</label>
        <input className={styles.mInput} value={name} onChange={e => setName(e.target.value)} placeholder="예: 스타필드 안성" />
        <label className={styles.mLabel}>주소</label>
        <input className={styles.mInput} value={addr} onChange={e => setAddr(e.target.value)} placeholder="예: 경기 안성시 공도읍..." />
        <label className={styles.mLabel}>종류</label>
        <div className={styles.typeGrid}>
          {TYPES.map(t => (
            <button
              key={t}
              className={type === t ? styles.typeOn : styles.typeBtn}
              onClick={() => setType(t)}
            >
              {TYPE_ICON[t]} {PLACE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.mCancel} onClick={onClose}>취소</button>
          <button className={styles.mSave} onClick={submit} disabled={saving || !name.trim()}>
            {saving ? '등록 중…' : '등록하고 계속'}
          </button>
        </div>
        <p className={styles.mHint}>등록한 장소는 바로 사용되며, 운영자 검토 후 정리될 수 있어요.</p>
      </div>
    </div>
  )
}
