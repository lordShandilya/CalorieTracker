import React, { useState } from 'react';

/** Simple spinner */
export function Spinner({ size = 24 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: size, height: size,
        border: '2px solid #e5e7eb',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
    </div>
  );
}

/** Error banner */
export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
      padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', color: '#dc2626', fontSize: 14, marginBottom: 12
    }}>
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>✕</button>}
    </div>
  );
}

/** Success banner */
export function SuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
      padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', color: '#16a34a', fontSize: 14, marginBottom: 12
    }}>
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontWeight: 600 }}>✕</button>}
    </div>
  );
}

/** Card wrapper */
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9',
      ...style
    }}>
      {children}
    </div>
  );
}

/** Button */
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, style = {}, type = 'button' }) {
  const base = {
    borderRadius: 8, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    opacity: disabled ? 0.6 : 1,
  };
  const sizes = { sm: { padding: '6px 12px', fontSize: 13 }, md: { padding: '9px 18px', fontSize: 14 }, lg: { padding: '12px 24px', fontSize: 15 } };
  const variants = {
    primary: { background: '#6366f1', color: '#fff' },
    secondary: { background: '#f1f5f9', color: '#374151' },
    danger: { background: '#ef4444', color: '#fff' },
    ghost: { background: 'transparent', color: '#6366f1', border: '1px solid #e5e7eb' },
    success: { background: '#22c55e', color: '#fff' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/** Form field wrapper */
export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>}
      {children}
      {hint && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

/** Input */
export function Input({ style = {}, ...props }) {
  return (
    <input style={{
      width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
      border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box',
      fontFamily: 'Inter, sans-serif', color: '#111827',
      ...style
    }} {...props} />
  );
}

/** Select */
export function Select({ style = {}, children, ...props }) {
  return (
    <select style={{
      width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
      border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box',
      fontFamily: 'Inter, sans-serif', color: '#111827', background: '#fff',
      ...style
    }} {...props}>
      {children}
    </select>
  );
}

/** Stat tile */
export function StatTile({ label, value, unit = '', color = '#6366f1', goal, style = {} }) {
  const pct = goal ? Math.min(100, Math.round(((parseFloat(value) || 0) / goal) * 100)) : null;
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '16px 20px',
      border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', ...style
    }}>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: 0 }}>
        {typeof value === 'number' ? Math.round(value) : value}
        <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280', marginLeft: 3 }}>{unit}</span>
      </p>
      {goal && (
        <div style={{ marginTop: 8 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: pct > 100 ? '#ef4444' : color, width: `${pct}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{pct}% of {Math.round(goal)}{unit} goal</p>
        </div>
      )}
    </div>
  );
}

/** Modal */
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: width,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Pagination controls */
export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20 }}>
      <Button size="sm" variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹ Prev</Button>
      <span style={{ padding: '6px 12px', fontSize: 13, color: '#6b7280' }}>Page {page} of {pages}</span>
      <Button size="sm" variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages}>Next ›</Button>
    </div>
  );
}
