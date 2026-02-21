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
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'log', icon: '🍽️', label: 'Meal Log' },
  { id: 'reports', icon: '📊', label: 'Reports' },
  { id: 'goals', icon: '🎯', label: 'Goals' },
  { id: 'ai', icon: '📸', label: 'AI Scanner' },
  { id: 'chat', icon: '💬', label: 'AI Chat' },
];

function Layout({ children, activePage, onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #f1f5f9',
        padding: '24px 0', display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🥗</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>CalTrack</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Nutrition Tracker</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, marginBottom: 4,
              background: activePage === item.id ? '#eef2ff' : 'transparent',
              color: activePage === item.id ? '#6366f1' : '#374151',
              textAlign: 'left', transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 8 }}>
            👤 {user?.username}
          </div>
          <button onClick={logout} style={{
            background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#6b7280',
            fontFamily: 'Inter, sans-serif', fontWeight: 500, width: '100%'
          }}>
            Sign Out
          </button>
        </div>
      </aside>
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 32px' }}>
        {children}
      </main>
    </div>
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
      <AppInner />
    </AuthProvider>
  );
}
