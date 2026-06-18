export default function Loading() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        fontFamily: "'Cute Font', cursive",
        fontSize: '36px', color: 'var(--accent)', letterSpacing: '3px',
        marginBottom: '12px',
      }}>
        TAKUROAD
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '13px' }}>불러오는 중...</p>
    </div>
  )
}
