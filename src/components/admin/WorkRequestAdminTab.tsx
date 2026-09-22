'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import AdminIcon from './AdminIcon'
import styles from './workRequest.module.css'
import {
  getAllWorkRequests, updateWorkRequest,
  WORK_REQUEST_STATUS, workRequestStatusLabel, WorkRequestStatus,
} from '@/services/workRequestService'

/* 작품 추가 요청 검수.
   승인은 자동 생성이 아니다 — '이 요청으로 등록'이 작품 등록 폼을 프리필로 열어주고,
   관리자가 유형·장르·소개를 채워 등록한 뒤 여기서 '등록됨'으로 바꾼다. */

const TABS = [...WORK_REQUEST_STATUS, { key: 'all' as const, label: '전체' }]

const BADGE_CLASS: Record<string, string> = {
  pending: styles.badgePending,
  approved: styles.badgeReviewed,
  rejected: styles.badgeAttention,
}

export default function WorkRequestAdminTab() {
  const { user } = useAuth()
  const [tab, setTab] = useState<string>('pending')
  const [rows, setRows] = useState<any[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const key = tab + ':' + reloadKey
  const loading = loadedKey !== key

  useEffect(() => {
    let alive = true
    getAllWorkRequests(tab)
      .then(d => { if (alive) { setRows(d); setLoadedKey(key) } })
      .catch(() => { if (alive) { setRows([]); setLoadedKey(key) } })
    return () => { alive = false }
  }, [tab, key])

  async function change(id: string, status: WorkRequestStatus) {
    if (!user) return
    const ok = await updateWorkRequest(id, { status }, user.id)
    if (ok) setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    else window.alert('상태 변경에 실패했어요.')
  }

  async function saveNote(id: string, adminNote: string) {
    if (!user) return
    const ok = await updateWorkRequest(id, { adminNote }, user.id)
    if (ok) setRows(prev => prev.map(r => (r.id === id ? { ...r, admin_note: adminNote } : r)))
    else window.alert('메모 저장에 실패했어요.')
  }

  function openRegister(r: any) {
    const q = new URLSearchParams({ name: r.name ?? '' })
    if (r.english_name) q.set('english', r.english_name)
    window.open('/work/new?' + q.toString(), '_blank')
  }

  const tabLabel = TABS.find(t => t.key === tab)?.label ?? '전체'

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.h1}>작품 추가 요청</h1>
          <p className={styles.headSub}>사용자가 요청한 작품을 확인하고, 직접 등록한 뒤 상태를 바꿔주세요</p>
        </div>
        <div className={styles.headRight}>
          <button type="button" className={styles.refreshBtn} onClick={() => setReloadKey(k => k + 1)}>
            <AdminIcon name="refresh" size={17} />새로고침
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.key} type="button"
            onClick={() => setTab(t.key)}
            className={tab === t.key ? `${styles.tab} ${styles.tabOn}` : styles.tab}>
            {t.label}
            {tab === t.key && !loading && <span className={styles.tabCount}>{rows.length}</span>}
          </button>
        ))}
      </div>

      <section className={styles.card}>
        <div className={styles.listHead}>
          <h2 className={styles.listTitle}>{tabLabel}</h2>
          <span className={styles.listCount}>{loading ? '—' : `${rows.length}건`}</span>
        </div>

        {loading ? (
          <div>
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.skelRow}>
                <div className={styles.skel} style={{ width: '40%', height: 15, marginBottom: 8 }} />
                <div className={styles.skel} style={{ width: '24%', height: 11 }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.state}>
            <span className={styles.stateIcon}><AdminIcon name="checkCircle" size={34} /></span>
            <strong className={styles.stateStrong}>
              {tab === 'pending' ? '검토 대기 중인 요청이 없습니다' : '해당 상태의 요청이 없습니다'}
            </strong>
            사용자가 남긴 작품 추가 요청이 여기에 모입니다
          </div>
        ) : (
          <div className={styles.rows}>
            {rows.map(r => (
              <div key={r.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h3 className={styles.itemName}>{r.name}</h3>
                  {r.english_name && <span className={styles.itemEng}>{r.english_name}</span>}
                  <span className={`${styles.badge} ${BADGE_CLASS[r.status] ?? ''}`}>
                    {workRequestStatusLabel(r.status)}
                  </span>
                </div>

                <div className={styles.itemMeta}>
                  {r.nickname ?? '알 수 없음'} · {new Date(r.created_at).toLocaleString('ko-KR')}
                </div>

                {r.note && <p className={styles.note}>{r.note}</p>}

                {r.ref_url && (
                  <a href={r.ref_url} target="_blank" rel="noreferrer" className={styles.extLink}>{r.ref_url}</a>
                )}

                <div className={styles.actions}>
                  <button type="button" className={styles.primaryBtn} onClick={() => openRegister(r)}>
                    <AdminIcon name="external" size={16} />이 요청으로 등록
                  </button>
                  {r.status !== 'approved' && (
                    <button type="button" className={styles.ghostBtn} onClick={() => change(r.id, 'approved')}>등록됨으로 표시</button>
                  )}
                  {r.status !== 'rejected' && (
                    <button type="button" className={styles.warnBtn} onClick={() => change(r.id, 'rejected')}>반려</button>
                  )}
                  {r.status !== 'pending' && (
                    <button type="button" className={styles.ghostBtn} onClick={() => change(r.id, 'pending')}>검토 중으로</button>
                  )}
                </div>

                <label className={styles.memoLabel} htmlFor={`memo-${r.id}`}>요청자에게 보일 메모</label>
                <textarea
                  id={`memo-${r.id}`}
                  className={styles.memo}
                  defaultValue={r.admin_note ?? ''}
                  placeholder="반려 사유나 안내를 적어주세요"
                  onBlur={e => { if (e.target.value !== (r.admin_note ?? '')) saveNote(r.id, e.target.value) }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
