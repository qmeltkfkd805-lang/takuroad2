/* "작성 중이던 내용을 불러왔어요" 안내 줄 — 새로 쓰기(저장본 지우고 빈 칸으로) / 닫기 */
export default function DraftNotice({ onDiscard, onClose, text = '작성 중이던 내용을 불러왔어요.' }: { onDiscard: () => void; onClose: () => void; text?: string }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--accent-l)', border: '1px solid rgba(255,86,146,.25)', borderRadius: 12, padding: '10px 14px', margin: '0 0 14px', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
      <span>{text}</span>
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <button type="button" onClick={onDiscard} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>새로 쓰기</button>
        <button type="button" onClick={onClose} aria-label="안내 닫기" style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 16, lineHeight: 1, padding: '4px 6px', cursor: 'pointer' }}>✕</button>
      </span>
    </div>
  )
}
