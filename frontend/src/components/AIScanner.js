import React, { useState, useRef } from 'react';
import { api } from '../api/client';
import { Card, Button, ErrorBanner, SuccessBanner, Spinner } from './UI';

export default function AIScanner({ onLogMeal }) {
  const [mode, setMode] = useState('image'); // 'image' | 'pdf'
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pdfEntries, setPdfEntries] = useState([]);
  const [pdfSummary, setPdfSummary] = useState('');
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setPdfEntries([]);
    setError('');
    if (mode === 'image' && f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      if (mode === 'image') {
        formData.append('image', file);
        const data = await api.analyzeImage(formData);
        setResult(data);
      } else {
        formData.append('pdf', file);
        const data = await api.parsePdf(formData);
        setPdfEntries(data.entries || []);
        setPdfSummary(data.summary || '');
      }
    } catch (e) {
      setError(e.message || 'Analysis failed. Make sure ANTHROPIC_API_KEY is set.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogResult = () => {
    if (result && onLogMeal) {
      onLogMeal(result);
      setSuccess('Nutritional data pre-filled in meal log!');
    }
  };

  const handleBulkImport = async () => {
    if (!pdfEntries.length) return;
    setLoading(true);
    try {
      const res = await api.bulkCreateEntries(pdfEntries);
      setSuccess(`Successfully imported ${res.created} entries!`);
      setPdfEntries([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🤖 AI Food Scanner</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>
          Upload a food photo or nutrition label to auto-extract nutritional info
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {/* Mode tabs */}
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[['image', '📸 Scan Food/Label'], ['pdf', '📄 Import PDF Diary']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setFile(null); setPreview(null); setResult(null); setPdfEntries([]); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 600, fontSize: 14, fontFamily: 'Inter, sans-serif',
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? '#6366f1' : '#6b7280',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <Card
        style={{ cursor: 'pointer', borderStyle: dragging ? 'solid' : 'dashed', borderWidth: 2, borderColor: dragging ? '#6366f1' : '#e5e7eb', background: dragging ? '#eef2ff' : '#fff', marginBottom: 20 }}
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{ textAlign: 'center', padding: '32px 20px' }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>{mode === 'image' ? '📸' : '📄'}</div>
          <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            {file ? file.name : `Drop your ${mode === 'image' ? 'image' : 'PDF'} here`}
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
            {mode === 'image' ? 'Supports JPEG, PNG, WebP (max 10MB)' : 'PDF food diary (max 20MB)'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={mode === 'image' ? 'image/*' : '.pdf,application/pdf'}
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <Button size="sm" style={{ marginTop: 14 }} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
            Choose File
          </Button>
        </div>
      </Card>

      {/* Image preview */}
      {preview && (
        <Card style={{ marginBottom: 20, textAlign: 'center' }}>
          <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, objectFit: 'contain' }} />
        </Card>
      )}

      {/* Analyze button */}
      {file && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Button onClick={handleAnalyze} disabled={loading} size="lg">
            {loading ? <><Spinner size={18} /> Analyzing...</> : `🔍 Analyze ${mode === 'image' ? 'Image' : 'PDF'}`}
          </Button>
        </div>
      )}

      {/* Image analysis result */}
      {result && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{result.food_name || 'Detected Food'}</h3>
              <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 13 }}>
                Confidence: <span style={{ color: result.confidence === 'high' ? '#10b981' : result.confidence === 'medium' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                  {result.confidence || 'N/A'}
                </span>
                {result.quantity && ` • ${result.quantity} ${result.quantity_unit || 'g'}`}
              </p>
            </div>
            <Button onClick={handleLogResult}>➕ Log This Meal</Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {[
              ['🔥 Calories', result.calories, 'kcal', '#6366f1'],
              ['💪 Protein', result.protein_g, 'g', '#10b981'],
              ['🌾 Carbs', result.carbs_g, 'g', '#f59e0b'],
              ['🧈 Fat', result.fat_g, 'g', '#f43f5e'],
              ['🌿 Fiber', result.fiber_g, 'g', '#06b6d4'],
              ['🧂 Sodium', result.sodium_mg, 'mg', '#8b5cf6'],
            ].map(([label, val, unit, color]) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color }}>
                  {Math.round(val || 0)}<span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 2 }}>{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {result.notes && (
            <div style={{ background: '#fffbeb', borderRadius: 8, padding: '10px 14px', marginTop: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>ℹ️ {result.notes}</p>
            </div>
          )}
        </Card>
      )}

      {/* PDF import results */}
      {pdfEntries.length > 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📄 Parsed {pdfEntries.length} entries</h3>
              {pdfSummary && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{pdfSummary}</p>}
            </div>
            <Button onClick={handleBulkImport} disabled={loading} variant="success">
              {loading ? 'Importing...' : `Import All ${pdfEntries.length} Entries`}
            </Button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {pdfEntries.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{e.food_name}</span>
                  <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>{e.meal_type} • {e.entry_date}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {Math.round(e.calories || 0)} kcal
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
