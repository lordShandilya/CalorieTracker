import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Card, Button, Input, Field, ErrorBanner, SuccessBanner, Spinner } from './UI';

const GOAL_PRESETS = {
  'Weight Loss': { daily_calories: 1600, protein_g: 140, carbs_g: 160, fat_g: 55, fiber_g: 30 },
  'Maintenance': { daily_calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65, fiber_g: 25 },
  'Muscle Gain': { daily_calories: 2500, protein_g: 200, carbs_g: 300, fat_g: 75, fiber_g: 30 },
  'Keto': { daily_calories: 1800, protein_g: 140, carbs_g: 25, fat_g: 130, fiber_g: 25 },
};

export default function Goals() {
  const [goals, setGoals] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getGoals()
      .then(g => { setGoals(g); setForm(g); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value === '' ? null : parseFloat(e.target.value) }));

  const applyPreset = (preset) => {
    setForm(f => ({ ...f, ...GOAL_PRESETS[preset] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateGoals(form);
      setGoals(updated);
      setSuccess('Goals saved successfully!');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={36} /></div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Health Goals</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Set your personalized nutrition targets</p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {/* Presets */}
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Quick Presets</h3>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 16px' }}>Start with a common goal template</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(GOAL_PRESETS).map(p => (
            <Button key={p} variant="ghost" size="sm" onClick={() => applyPreset(p)}>
              {p}
            </Button>
          ))}
        </div>
      </Card>

      <form onSubmit={handleSave}>
        {/* Calorie goal */}
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Calorie Goal</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Daily Calorie Target (kcal)">
              <Input type="number" value={form.daily_calories || ''} onChange={setF('daily_calories')} placeholder="e.g. 2000" min="0" />
            </Field>
            <Field label="Weight Goal (kg)" hint="Your target body weight">
              <Input type="number" value={form.weight_goal_kg || ''} onChange={setF('weight_goal_kg')} placeholder="e.g. 75" min="0" step="0.1" />
            </Field>
          </div>
        </Card>

        {/* Macro goals */}
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Macronutrient Goals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <Field label="Protein (g/day)">
              <Input type="number" value={form.protein_g || ''} onChange={setF('protein_g')} placeholder="e.g. 150" min="0" />
            </Field>
            <Field label="Carbohydrates (g/day)">
              <Input type="number" value={form.carbs_g || ''} onChange={setF('carbs_g')} placeholder="e.g. 250" min="0" />
            </Field>
            <Field label="Fat (g/day)">
              <Input type="number" value={form.fat_g || ''} onChange={setF('fat_g')} placeholder="e.g. 65" min="0" />
            </Field>
          </div>

          {/* Calorie breakdown hint */}
          {(form.protein_g || form.carbs_g || form.fat_g) && (
            <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#0369a1' }}>
                📊 Macro calories: {' '}
                {Math.round(((form.protein_g || 0) * 4) + ((form.carbs_g || 0) * 4) + ((form.fat_g || 0) * 9))} kcal
                {' '}(P: {Math.round((form.protein_g || 0) * 4)} + C: {Math.round((form.carbs_g || 0) * 4)} + F: {Math.round((form.fat_g || 0) * 9)})
              </p>
            </div>
          )}
        </Card>

        {/* Micro goals */}
        <Card style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Micronutrient Goals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <Field label="Fiber (g/day)">
              <Input type="number" value={form.fiber_g || ''} onChange={setF('fiber_g')} placeholder="e.g. 25" min="0" />
            </Field>
            <Field label="Sodium (mg/day)">
              <Input type="number" value={form.sodium_mg || ''} onChange={setF('sodium_mg')} placeholder="e.g. 2300" min="0" />
            </Field>
            <Field label="Sugar (g/day)">
              <Input type="number" value={form.sugar_g || ''} onChange={setF('sugar_g')} placeholder="e.g. 50" min="0" />
            </Field>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Goals'}
          </Button>
        </div>
      </form>
    </div>
  );
}
