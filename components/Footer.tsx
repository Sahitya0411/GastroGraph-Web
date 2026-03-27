
export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '40px 0',
      marginTop: 'auto',
    }}>
      <div className="container" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/GastroGraph2.png" alt="GastroGraph Logo" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(0,212,170,0.5))' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>
              Gastro<span style={{ color: 'var(--accent)' }}>Graph</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Ingredient Intelligence · GNN-powered Substitution
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          BTP · IIIT Delhi · 2026 · MIT License
        </div>
      </div>
    </footer>
  );
}
