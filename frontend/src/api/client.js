/**
 * API client for communicating with the backend.
 * All API calls go through this module for centralized error handling.
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body = null, isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${path}`, opts);

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({ error: 'Invalid response' }));

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status);
  }

  return data;
}

export const api = {
  // Auth
  signup: (payload) => request('POST', '/auth/signup', payload),
  login: (payload) => request('POST', '/auth/login', payload),

  // Goals
  getGoals: () => request('GET', '/goals'),
  updateGoals: (payload) => request('PUT', '/goals', payload),

  // Food entries
  listEntries: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return request('GET', `/entries${qs ? '?' + qs : ''}`);
  },
  createEntry: (payload) => request('POST', '/entries', payload),
  updateEntry: (id, payload) => request('PUT', `/entries/${id}`, payload),
  deleteEntry: (id) => request('DELETE', `/entries/${id}`),
  bulkCreateEntries: (entries) => request('POST', '/entries/bulk', { entries }),

  // Reports
  getDailyReport: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request('GET', `/reports/daily${qs ? '?' + qs : ''}`);
  },
  getWeeklyReport: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request('GET', `/reports/weekly${qs ? '?' + qs : ''}`);
  },
  getGoalComparison: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request('GET', `/reports/goal-comparison${qs ? '?' + qs : ''}`);
  },
  getMicronutrients: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request('GET', `/reports/micronutrients${qs ? '?' + qs : ''}`);
  },

  // AI
  analyzeImage: (formData) => request('POST', '/ai/analyze-image', formData, true),
  chat: (message) => request('POST', '/ai/chat', { message }),
  getChatHistory: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request('GET', `/ai/chat/history${qs ? '?' + qs : ''}`);
  },
  parsePdf: (formData) => request('POST', '/ai/parse-pdf', formData, true),
};

export { ApiError };
