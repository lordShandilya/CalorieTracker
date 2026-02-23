import React, { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './utils/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import MealLog from './components/MealLog';
import Reports from './components/Reports';
import Goals from './components/Goals';
import AIScanner from './components/AIScanner';
import ChatInterface from './components/ChatInterface';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '', label: 'Dashboard' },
  { id: 'log',       icon: '', label: 'Meal Log' },
  { id: 'reports',   icon: '', label: 'Reports' },
  { id: 'goals',     icon: '', label: 'Goals' },
  { id: 'ai',        icon: '', label: 'AI Scanner' },
  { id: 'chat',      icon: '', label: 'AI Chat' },
];

function Layout({ children, activePage, onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        padding: '24px 0', display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}></span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>CalTrack</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nutrition Tracker</div></div></div></div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item.id;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, marginBottom: 4,
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                textAlign: 'left', transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
             {user?.username}
          </div>
          <button onClick={logout} style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif', fontWeight: 500, width: '100%',
            transition: 'all 0.15s' }}>
            Sign Out
          </button></div></aside>

      {/* Main content */}
      <main style={{
        marginLeft: 220, flex: 1, padding: '32px',
        background: 'var(--bg-base)', minHeight: '100vh' }}>
        {children}
      </main></div>
  );
}

function AppInner() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [mealPrefill, setMealPrefill] = useState(null);

  const navigate = useCallback((page) => setActivePage(page), []);

  const handleLogFromAI = useCallback((data) => {
    setMealPrefill(data);
    setActivePage('log');
  }, []);

  if (!user) return <AuthPage />;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'log':       return <MealLog prefillData={mealPrefill} onPrefillUsed={() => setMealPrefill(null)} />;
      case 'reports':   return <Reports />;
      case 'goals':     return <Goals />;
      case 'ai':        return <AIScanner onLogMeal={handleLogFromAI} />;
      case 'chat':      return <ChatInterface onLogMeal={handleLogFromAI} />;
      default:          return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner /></AuthProvider>
  );
}