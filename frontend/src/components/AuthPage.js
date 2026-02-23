import React, { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { Button, Input, Field, ErrorBanner } from './UI';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await signup(form.username, form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}></div>
          <h1 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 30, fontWeight: 800 }}>CalTrack</h1>
          <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: 15 }}>
            Your personal nutrition companion
          </p></div>

        {/* Form card */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 20, padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
          {/* Mode tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-base)',
            borderRadius: 10, padding: 4, marginBottom: 24,
            border: '1px solid var(--border)' }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
                  cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s' }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <ErrorBanner message={error} onDismiss={() => setError('')} />

          <form onSubmit={handleSubmit}>
            <Field label="Username or Email">
              <Input value={form.username} onChange={set('username')}
                placeholder="Enter username or email" required /></Field>
            {mode === 'signup' && (
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set('email')}
                  placeholder="you@example.com" required /></Field>
            )}
            <Field label="Password">
              <Input type="password" value={form.password} onChange={set('password')}
                placeholder="Min. 6 characters" required /></Field>
            <Button type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button></form>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontWeight: 600, cursor: 'pointer' }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button></p></div></div></div>
  );
}