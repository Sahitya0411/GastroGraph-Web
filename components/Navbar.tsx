'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  { href: '/',                    label: 'Home' },
  { href: '/ingredient-explorer', label: 'Explorer' },
  { href: '/finder',              label: 'Substitute Finder' },
  { href: '/context',             label: 'Context Reranker' },
  { href: '/about',               label: 'About' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(6,11,20,0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/GastroGraph2.png"
            alt="GastroGraph Logo"
            width={40}
            height={40}
            style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(0,212,170,0.5))' }}
          />
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
            Gastro<span style={{ color: 'var(--accent)' }}>Graph</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: '8px 16px',
              borderRadius: 50,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s',
              background: pathname === l.href ? 'var(--accent-glow)' : 'transparent',
              color: pathname === l.href ? 'var(--accent)' : 'var(--text-secondary)',
              border: pathname === l.href ? '1px solid rgba(0,212,170,0.3)' : '1px solid transparent',
            }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="mobile-menu-btn"
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 18,
          }}
        >{open ? '✕' : '☰'}</button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          padding: '12px 24px',
        }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
              display: 'block',
              padding: '12px 0',
              textDecoration: 'none',
              fontSize: 15,
              color: pathname === l.href ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: '1px solid var(--border)',
            }}>
              {l.label}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .desktop-nav { display: flex; }
        .mobile-menu-btn { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none; }
          .mobile-menu-btn { display: block; }
        }
      `}</style>
    </nav>
  );
}
