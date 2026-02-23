import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Card, Button, Spinner, ErrorBanner } from './UI';

function stripMealBlocks(text) {
  if (!text) return text;
  text = text.replace(/<<MEAL_DATA>>[\s\S]*?<<\/MEAL_DATA>>/g, '');
  text = text.replace(/```json_meal[\s\S]*?```/g, '');
  return text.trim();
}

export default function ChatInterface({ onLogMeal }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    api.getChatHistory({ per_page: 20 })
      .then(res => { setMessages(res.items || []); setHistoryLoaded(true); })
      .catch(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setInput(''); setError('');
    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await api.chat(msg);
      const assistantMsg = { role: 'assistant', content: stripMealBlocks(res.response), created_at: new Date().toISOString() };
      setMessages(m => [...m, assistantMsg]);
      if (res.meal_suggestion && onLogMeal) {
        setMessages(m => [...m, { role: 'system_action', meal: res.meal_suggestion, content: 'meal_suggestion' }]);
      }
    } catch (e) {
      setError(e.message || 'Chat failed.');
      setMessages(m => m.filter(msg => msg !== userMsg));
    } finally { setLoading(false); }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
    try { await api.clearChatHistory(); setMessages([]); }
    catch (e) { setError('Failed to clear history'); }
  };

  const QUICK_PROMPTS = [
    "What did I eat today?", "How many calories do I have left today?",
    "Log 100g grilled chicken for lunch", "Give me a weekly summary",
    "Am I hitting my protein goal?", "Suggest a healthy dinner",
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}> AI Nutrition Assistant</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Ask about your nutrition, log meals, or get personalized advice</p></div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearHistory} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
             Clear History
          </Button>
        )}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {messages.length === 0 && historyLoaded && (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 10px' }}> Try asking:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => setInput(p)} style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', fontWeight: 500,
              }}>{p}</button>
            ))}
          </div></Card>
      )}

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
        {!historyLoaded ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={28} /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}></div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>Hi! I'm your AI nutrition assistant.</p>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>Ask me anything about your nutrition, or use the quick prompts above.</p></div>
        ) : (
          messages.map((msg, i) => {
            if (msg.content === 'meal_suggestion') {
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                  <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 12, padding: '10px 16px', maxWidth: '80%', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#86efac', fontWeight: 500 }}>
                       Suggested: <strong>{msg.meal.food_name}</strong> ({Math.round(msg.meal.calories || 0)} kcal)
                    </p>
                    <Button size="sm" variant="success" onClick={() => onLogMeal && onLogMeal(msg.meal)}>+ Log This Meal</Button></div></div>
              );
            }
            const isUser = msg.role === 'user';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                {!isUser && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, fontSize: 16 }}></div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isUser ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {isUser ? msg.content : stripMealBlocks(msg.content)}
                </div>
                {isUser && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0, fontSize: 16 }}></div>
                )}
              </div>
            );
          })
        )}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}></div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '18px 18px 18px 4px', padding: '10px 16px' }}>
              <Spinner size={18} /></div></div>
        )}
        <div ref={messagesEndRef} /></div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask about your nutrition, log a meal..." disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 24,
            border: '1px solid var(--border)', fontSize: 14, outline: 'none',
            fontFamily: 'Inter, sans-serif', background: 'var(--bg-elevated)',
            color: 'var(--text-primary)' }}
        />
        <Button type="submit" disabled={loading || !input.trim()} style={{ borderRadius: 24, padding: '12px 20px' }}>
          {loading ? <Spinner size={18} /> : '↑ Send'}
        </Button></form></div>
  );
}