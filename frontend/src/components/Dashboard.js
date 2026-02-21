import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Card, StatTile, Spinner, Button } from './UI';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const MEAL_COLORS = {
  breakfast: '#f59e0b',
  lunch: '#10b981',
  dinner: '#6366f1',
  snacks: '#f43f5e'
};

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState(null);
  const [goals, setGoals] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [goalsRes, dailyRes] = await Promise.all([
          api.getGoals(),
          api.getDailyReport({ start_date: today, end_date: today })
        ]);
        setGoals(goalsRes);

        // Today's totals
        const dayTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, by_meal: {} };
        (dailyRes.days || []).forEach(d => {
          dayTotals.calories += d.calories || 0;
          dayTotals.protein_g += d.protein_g || 0;
          dayTotals.carbs_g += d.carbs_g || 0;
          dayTotals.fat_g += d.fat_g || 0;
          Object.assign(dayTotals.by_meal, d.by_meal);
        });
        setTodayData(dayTotals);

        // Weekly trend
        const weekStart = format(new Date(Date.now() - 6 * 86400000), 'yyyy-MM-dd');
        const weeklyRes = await api.getDailyReport({ start_date: weekStart, end_date: today });
        // Build full 7-day range
        const dayMap = {};
        (weeklyRes.days || []).forEach(d => { dayMap[d.date] = d; });
        const week = [];
        for (let i = 6; i >= 0; i--) {
          const dt = format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd');
          const label = format(new Date(Date.now() - i * 86400000), 'EEE');
          week.push({ date: dt, label, calories: dayMap[dt]?.calories || 0 });
        }
        setWeeklyData(week);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>;

  const mealBreakdown = Object.entries(todayData?.by_meal || {}).map(([meal, data]) => ({
    name: meal.charAt(0).toUpperCase() + meal.slice(1),
    calories: Math.round(data.calories || 0),
    color: MEAL_COLORS[meal]
  }));

  // Macro ring data
  const totalMacroG = (todayData?.protein_g || 0) + (todayData?.carbs_g || 0) + (todayData?.fat_g || 0);
  const macros = [
    { name: 'Protein', value: Math.round(todayData?.protein_g || 0), color: '#6366f1', pct: totalMacroG ? Math.round(((todayData?.protein_g || 0) / totalMacroG) * 100) : 0 },
    { name: 'Carbs', value: Math.round(todayData?.carbs_g || 0), color: '#f59e0b', pct: totalMacroG ? Math.round(((todayData?.carbs_g || 0) / totalMacroG) * 100) : 0 },
    { name: 'Fat', value: Math.round(todayData?.fat_g || 0), color: '#f43f5e', pct: totalMacroG ? Math.round(((todayData?.fat_g || 0) / totalMacroG) * 100) : 0 },
  ];

  const goalCalories = goals?.daily_calories || 2000;
  const caloriesLeft = Math.max(0, goalCalories - (todayData?.calories || 0));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Welcome header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#111827' }}>
          Today's Dashboard
        </h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <Button onClick={() => onNavigate('log')} size="sm">
          Log Meal
        </Button>
        <Button onClick={() => onNavigate('ai')} variant="secondary" size="sm">
          Scan Food
        </Button>
        <Button onClick={() => onNavigate('chat')} variant="secondary" size="sm">
          AI Chat
        </Button>
        <Button onClick={() => onNavigate('reports')} variant="secondary" size="sm">
          Reports
        </Button>
      </div>

      {/* Main stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatTile label="Calories Consumed" value={Math.round(todayData?.calories || 0)} unit=" kcal"
          color="#6366f1" goal={goalCalories} />
        <StatTile label="Calories Remaining" value={caloriesLeft} unit=" kcal" color="#10b981" />
        <StatTile label="Protein" value={Math.round(todayData?.protein_g || 0)} unit="g"
          color="#6366f1" goal={goals?.protein_g} />
        <StatTile label="Carbohydrates" value={Math.round(todayData?.carbs_g || 0)} unit="g"
          color="#f59e0b" goal={goals?.carbs_g} />
        <StatTile label="Fat" value={Math.round(todayData?.fat_g || 0)} unit="g"
          color="#f43f5e" goal={goals?.fat_g} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Weekly calorie trend */}
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Weekly Calorie Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${Math.round(v)} kcal`, 'Calories']} />
              <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, i) => (
                  <Cell key={i} fill={entry.date === today ? '#6366f1' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {goalCalories && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ width: 12, height: 2, background: '#ef4444' }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Daily goal: {goalCalories} kcal</span>
            </div>
          )}
        </Card>

        {/* Macro breakdown */}
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Today's Macros</h3>
          {totalMacroG > 0 ? (
            <>
              {macros.map(m => (
                <div key={m.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{m.name}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{m.value}g ({m.pct}%)</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6 }}>
                    <div style={{ height: '100%', borderRadius: 4, background: m.color, width: `${m.pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
              <p style={{ margin: 0 }}>No meals logged today yet</p>
              <Button onClick={() => onNavigate('log')} size="sm" style={{ marginTop: 12 }}>Log your first meal</Button>
            </div>
          )}
        </Card>
      </div>

      {/* Meal breakdown */}
      {mealBreakdown.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🍽️ Calories by Meal</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {mealBreakdown.map(m => (
              <div key={m.name} style={{
                flex: '1 1 120px', background: '#f9fafb', borderRadius: 10,
                padding: '12px 16px', borderLeft: `3px solid ${m.color}`
              }}>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{m.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: m.color }}>{m.calories}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>kcal</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
