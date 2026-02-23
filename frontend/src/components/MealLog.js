import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { Card, Button, Input, Select, Field, ErrorBanner, SuccessBanner, Spinner, Modal, Pagination } from './UI';
import { format } from 'date-fns';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snacks: '🍎' };

const EMPTY_FORM = {
  food_name: '', meal_type: 'breakfast', quantity: '', quantity_unit: 'g',
  entry_date: format(new Date(), 'yyyy-MM-dd'),
  calories: '', protein_g: '', carbs_g: '', fat_g: '',
  fiber_g: '', sugar_g: '', sodium_mg: '',
  vitamin_c_mg: '', vitamin_d_iu: '', calcium_mg: '', iron_mg: '',
  notes: ''
};

export default function MealLog({ prefillData, onPrefillUsed }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(prefillData || {}) });
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterMeal, setFilterMeal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (filterDate) { params.start_date = filterDate; params.end_date = filterDate; }
      else {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      if (filterMeal) params.meal_type = filterMeal;
      const res = await api.listEntries(params);
      setEntries(res.items || []);
      setPagination(res.pagination || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterDate, filterMeal, startDate, endDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    if (prefillData) {
      setForm(f => ({ ...f, ...prefillData }));
      setShowModal(true);
      if (onPrefillUsed) onPrefillUsed();
    }
  }, [prefillData, onPrefillUsed]);

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setForm({
      food_name: entry.food_name, meal_type: entry.meal_type,
      quantity: entry.quantity, quantity_unit: entry.quantity_unit,
      entry_date: entry.entry_date, calories: entry.calories || '',
      protein_g: entry.protein_g || '', carbs_g: entry.carbs_g || '',
      fat_g: entry.fat_g || '', fiber_g: entry.fiber_g || '',
      sugar_g: entry.sugar_g || '', sodium_mg: entry.sodium_mg || '',
      vitamin_c_mg: entry.vitamin_c_mg || '', vitamin_d_iu: entry.vitamin_d_iu || '',
      calcium_mg: entry.calcium_mg || '', iron_mg: entry.iron_mg || '',
      notes: entry.notes || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editEntry) {
        await api.updateEntry(editEntry.id, form);
        setSuccess('Entry updated!');
      } else {
        await api.createEntry(form);
        setSuccess('Meal logged successfully!');
      }
      setShowModal(false);
      loadEntries();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.deleteEntry(id);
      setSuccess('Entry deleted');
      loadEntries();
    } catch (e) {
      setError(e.message);
    }
  };

  // Group entries by date + meal
  const grouped = {};
  entries.forEach(e => {
    const key = e.entry_date;
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][e.meal_type]) grouped[key][e.meal_type] = [];
    grouped[key][e.meal_type].push(e);
  });
  const sortedDates = Object.keys(grouped).sort().reverse();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Meal Log</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>Track your daily food intake</p>
        </div>
        <Button onClick={openCreate}>➕ Log Meal</Button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Filter by Date</label>
            <Input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Meal Type</label>
            <Select value={filterMeal} onChange={e => { setFilterMeal(e.target.value); setPage(1); }}>
              <option value="">All Meals</option>
              {MEAL_TYPES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </Select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Date Range From</label>
            <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFilterDate(''); setPage(1); }} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>To</label>
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setFilterDate(''); setPage(1); }} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterMeal(''); setStartDate(''); setEndDate(''); setPage(1); }}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Entry list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={32} /></div>
      ) : sortedDates.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <p style={{ color: '#9ca3af', margin: 0 }}>No meals logged yet. Click "Log Meal" to get started!</p>
        </Card>
      ) : (
        sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {date === format(new Date(), 'yyyy-MM-dd') ? '📅 Today' : `📅 ${date}`}
            </h3>
            {MEAL_TYPES.filter(m => grouped[date][m]).map(meal => (
              <Card key={meal} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 18, marginRight: 8 }}>{MEAL_ICONS[meal]}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{meal}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>
                    {Math.round(grouped[date][meal].reduce((s, e) => s + (e.calories || 0), 0))} kcal
                  </span>
                </div>
                {grouped[date][meal].map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 0',
                    borderTop: '1px solid #f1f5f9', gap: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{entry.food_name}</span>
                      <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>
                        {entry.quantity}{entry.quantity_unit}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                      <span>{Math.round(entry.calories || 0)} kcal</span>
                      <span>P: {Math.round(entry.protein_g || 0)}g</span>
                      <span>C: {Math.round(entry.carbs_g || 0)}g</span>
                      <span>F: {Math.round(entry.fat_g || 0)}g</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>✏️</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)} style={{ color: '#ef4444' }}>🗑️</Button>
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        ))
      )}

      <Pagination page={pagination.page} pages={pagination.pages} onPage={setPage} />

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editEntry ? 'Edit Food Entry' : 'Log a Meal'} width={600}>
        <form onSubmit={handleSave}>
          <ErrorBanner message={error} onDismiss={() => setError('')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Food Name" style={{ gridColumn: '1/-1' }}>
              <Input value={form.food_name} onChange={setF('food_name')} placeholder="e.g. Grilled Chicken Breast" required />
            </Field>
            <Field label="Meal Type">
              <Select value={form.meal_type} onChange={setF('meal_type')}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{MEAL_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.entry_date} onChange={setF('entry_date')} required />
            </Field>
            <Field label="Quantity">
              <Input type="number" value={form.quantity} onChange={setF('quantity')} placeholder="e.g. 200" min="0" step="any" required />
            </Field>
            <Field label="Unit">
              <Select value={form.quantity_unit} onChange={setF('quantity_unit')}>
                {['g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'serving', 'piece'].map(u =>
                  <option key={u} value={u}>{u}</option>
                )}
              </Select>
            </Field>
          </div>

          <h4 style={{ margin: '16px 0 12px', fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Macronutrients
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[['calories', 'kcal'], ['protein_g', 'Protein (g)'], ['carbs_g', 'Carbs (g)'], ['fat_g', 'Fat (g)']].map(([k, label]) => (
              <Field key={k} label={label}>
                <Input type="number" value={form[k]} onChange={setF(k)} placeholder="0" min="0" step="any" />
              </Field>
            ))}
          </div>

          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12 }}>
            {showAdvanced ? '▾' : '▸'} Micronutrients & Details
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                ['fiber_g', 'Fiber (g)'], ['sugar_g', 'Sugar (g)'], ['sodium_mg', 'Sodium (mg)'],
                ['vitamin_c_mg', 'Vitamin C (mg)'], ['vitamin_d_iu', 'Vitamin D (IU)'],
                ['calcium_mg', 'Calcium (mg)'], ['iron_mg', 'Iron (mg)']
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input type="number" value={form[k]} onChange={setF(k)} placeholder="0" min="0" step="any" />
                </Field>
              ))}
              <Field label="Notes" style={{ gridColumn: '1/-1' }}>
                <Input value={form.notes} onChange={setF('notes')} placeholder="Optional notes..." />
              </Field>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editEntry ? 'Update Entry' : 'Log Meal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
