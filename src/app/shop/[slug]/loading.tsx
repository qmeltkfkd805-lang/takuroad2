export default function ShopLoading() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 80px' }}>
      {/* 헤더 스켈레톤 */}
      <div style={{ height: '260px', background: 'var(--surface2)', marginBottom: '0' }} />

      <div style={{ padding: '20px' }}>
        {/* 이름 */}
        <div style={{ height: '28px', width: '60%', background: 'var(--border)', borderRadius: '6px', marginBottom: '12px' }} />
        {/* 태그 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[1,2].map(i => (
            <div key={i} style={{ height: '24px', width: '70px', background: 'var(--border)', borderRadius: '12px' }} />
          ))}
        </div>
        {/* 정보 라인들 */}
        {[1,2,3].map(i => (
          <div key={i} style={{ height: '16px', width: '80%', background: 'var(--border)', borderRadius: '4px', marginBottom: '12px' }} />
        ))}
      </div>
    </div>
  )
}
