import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Card, Spinner, Button, ErrorBanner, StatTile } from './UI';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Cell, PieChart, Pie
} from 'recharts';

const COLORS = { protein: '#6366f1', carbs: '#f59e0b', fat: '#f43f5e', calories: '#10b981', fiber: '#06b6d4' };

export default function Reports() {
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [daily, setDaily] = useState([]);
  const [goalComp, setGoalComp] = useState(null);
  const [micros, setMicros] = useState(null);
  const [activeTab, setActiveTab] = useState('trends');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [dailyRes, goalRes, microRes] = await Promise.all([
        api.getDailyReport({ period }),
        api.getGoalComparison({ period }),
        api.getMicronutrients({ period }),
      ]);

      setDaily(dailyRes.days || []);
      setGoalComp(goalRes);
      setMicros(microRes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  // Macro pie data from totals
  const macroTotal = daily.reduce((acc, d) => ({
    protein: acc.protein + (d.protein_g || 0),
    carbs: acc.carbs + (d.carbs_g || 0),
    fat: acc.fat + (d.fat_g || 0),
  }), { protein: 0, carbs: 0, fat: 0 });

  const macropieData = [
    { name: 'Protein', value: Math.round(macroTotal.protein), color: COLORS.protein },
    { name: 'Carbs', value: Math.round(macroTotal.carbs), color: COLORS.carbs },
    { name: 'Fat', value: Math.round(macroTotal.fat), color: COLORS.fat },
  ].filter(d => d.value > 0);

  // Goal comparison data
  const goals = goalComp?.goals || {};
  const actuals = goalComp?.actuals || {};
  const goalCompData = [
    { name: 'Calories', goal: goals.daily_calories, actual: actuals.avg_calories ? Math.round(actuals.avg_calories) : 0 },
    { name: 'Protein (g)', goal: goals.protein_g, actual: actuals.avg_protein_g ? Math.round(actuals.avg_protein_g) : 0 },
    { name: 'Carbs (g)', goal: goals.carbs_g, actual: actuals.avg_carbs_g ? Math.round(actuals.avg_carbs_g) : 0 },
    { name: 'Fat (g)', goal: goals.fat_g, actual: actuals.avg_fat_g ? Math.round(actuals.avg_fat_g) : 0 },
  ].filter(d => d.goal);

  // Micronutrient radar (normalized to % of daily recommended)
  const RDAs = { vitamin_c: 90, vitamin_d: 600, calcium: 1000, iron: 18, fiber: 25, sodium: 2300 };
  const microRadar = micros ? [
    { nutrient: 'Vitamin C', value: Math.min(150, Math.round(((micros.avg_daily_vitamin_c_mg || 0) / RDAs.vitamin_c) * 100)) },
    { nutrient: 'Vitamin D', value: Math.min(150, Math.round(((micros.avg_daily_vitamin_d_iu || 0) / RDAs.vitamin_d) * 100)) },
    { nutrient: 'Calcium', value: Math.min(150, Math.round(((micros.avg_daily_calcium_mg || 0) / RDAs.calcium) * 100)) },
    { nutrient: 'Iron', value: Math.min(150, Math.round(((micros.avg_daily_iron_mg || 0) / RDAs.iron) * 100)) },
    { nutrient: 'Fiber', value: Math.min(150, Math.round(((micros.avg_daily_fiber_g || 0) / RDAs.fiber) * 100)) },
  ] : [];

  const tabs = ['trends', 'macros', 'goals', 'micros'];
  const tabLabels = { trends: '📈 Trends', macros: '🥜 Macros', goals: '🎯 Goals', micros: '💊 Micros' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📊 Nutrition Reports</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Visualize your dietary patterns and trends</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['week', 'month'].map(p => (
            <Button key={p} size="sm" variant={period === p ? 'primary' : 'ghost'} onClick={() => setPeriod(p)}>
              {p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
            </Button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif',
            background: activeTab === t ? '#fff' : 'transparent',
            color: activeTab === t ? '#6366f1' : '#6b7280',
            boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={36} /></div>
      ) : (
        <>
          {/* Trends tab */}
          {activeTab === 'trends' && (
            <>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                {(() => {
                  const totalCal = daily.reduce((s, d) => s + (d.calories || 0), 0);
                  const days = daily.length || 1;
                  return <>
                    <StatTile label="Avg Daily Calories" value={Math.round(totalCal / days)} unit=" kcal" color="#10b981" />
                    <StatTile label="Days Tracked" value={daily.length} color="#6366f1" />
                    <StatTile label="Total Calories" value={Math.round(totalCal)} unit=" kcal" color="#f59e0b" />
                  </>;
                })()}
              </div>

              <Card style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Daily Calorie Intake</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={daily.map(d => ({ date: d.date.slice(5), calories: Math.round(d.calories || 0) }))}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} kcal`, 'Calories']} />
                    {goals.daily_calories && (
                      <Line type="monotone" dataKey={() => goals.daily_calories} stroke="#ef4444" strokeDasharray="5 5" name="Goal" />
                    )}
                    <Bar dataKey="calories" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Daily Macros Breakdown</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={daily.map(d => ({
                    date: d.date.slice(5),
                    Protein: Math.round(d.protein_g || 0),
                    Carbs: Math.round(d.carbs_g || 0),
                    Fat: Math.round(d.fat_g || 0),
                  }))}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Protein" stackId="a" fill={COLORS.protein} />
                    <Bar dataKey="Carbs" stackId="a" fill={COLORS.carbs} />
                    <Bar dataKey="Fat" stackId="a" fill={COLORS.fat} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {/* Macros tab */}
          {activeTab === 'macros' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Macronutrient Distribution</h3>
                {macropieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={macropieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({name, pct}) => `${name}`}>
                          {macropieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v}g`, n]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                      {macropieData.map(m => {
                        const total = macropieData.reduce((s, d) => s + d.value, 0);
                        const pct = total ? Math.round((m.value / total) * 100) : 0;
                        return (
                          <div key={m.name} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}g</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.name} ({pct}%)</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>No data for this period</p>
                )}
              </Card>

              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Daily Macro Lines</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={daily.map(d => ({
                    date: d.date.slice(5),
                    Protein: Math.round(d.protein_g || 0),
                    Carbs: Math.round(d.carbs_g || 0),
                    Fat: Math.round(d.fat_g || 0),
                  }))}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Protein" stroke={COLORS.protein} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Carbs" stroke={COLORS.carbs} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Fat" stroke={COLORS.fat} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* Goals tab */}
          {activeTab === 'goals' && (
            <Card>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Goal vs. Actual (Daily Average)</h3>
              {goalCompData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={goalCompData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="goal" fill="#e5e7eb" name="Goal" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20 }}>
                    {goalCompData.map(d => {
                      const pct = d.goal ? Math.round((d.actual / d.goal) * 100) : 0;
                      const over = pct > 100;
                      return (
                        <div key={d.name} style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: 10 }}>
                          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{d.name}</p>
                          <p style={{ margin: '4px 0', fontSize: 20, fontWeight: 700, color: over ? '#ef4444' : '#6366f1' }}>
                            {pct}%
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                            {d.actual} / {d.goal} {over ? '⚠️ over goal' : '✓'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>
                  Set goals in the Goals page to see comparisons
                </p>
              )}
            </Card>
          )}

          {/* Micros tab */}
          {activeTab === 'micros' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Card>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Micronutrient Coverage</h3>
                <p style={{ color: '#9ca3af', fontSize: 12, margin: '0 0 16px' }}>% of daily recommended intake</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={microRadar}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Intake" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Tooltip formatter={(v) => [`${v}%`, '% RDA']} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Daily Averages</h3>
                {micros && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      ['Fiber', micros.avg_daily_fiber_g, 'g', RDAs.fiber],
                      ['Sodium', micros.avg_daily_sodium_mg, 'mg', RDAs.sodium],
                      ['Vitamin C', micros.avg_daily_vitamin_c_mg, 'mg', RDAs.vitamin_c],
                      ['Vitamin D', micros.avg_daily_vitamin_d_iu, 'IU', RDAs.vitamin_d],
                      ['Calcium', micros.avg_daily_calcium_mg, 'mg', RDAs.calcium],
                      ['Iron', micros.avg_daily_iron_mg, 'mg', RDAs.iron],
                    ].map(([name, val, unit, rda]) => {
                      const v = Math.round(val || 0);
                      const pct = Math.min(100, Math.round((v / rda) * 100));
                      return (
                        <div key={name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>{v} {unit} / {rda} {unit} ({pct}%)</span>
                          </div>
                          <div style={{ background: '#f1f5f9', borderRadius: 4, height: 5 }}>
                            <div style={{ height: '100%', borderRadius: 4, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e', width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
