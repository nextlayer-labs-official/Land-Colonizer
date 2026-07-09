import { API_URL } from './config';
import NProgress from 'nprogress';

const BASE_URL = API_URL;

// Track in-flight requests so the bar only stops when all finish
let _inflight = 0;
function startBar() {
  if (typeof window === 'undefined') return;
  if (_inflight === 0) NProgress.start();
  _inflight++;
}
function stopBar() {
  if (typeof window === 'undefined') return;
  _inflight = Math.max(0, _inflight - 1);
  if (_inflight === 0) NProgress.done();
}

function authHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiGet(endpoint) {
  startBar();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}

export async function apiPost(endpoint, body) {
  startBar();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}

export async function apiPut(endpoint, body) {
  startBar();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}

export async function apiPatch(endpoint, body = {}) {
  startBar();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}

export async function apiPostForm(endpoint, formData, method = 'POST') {
  startBar();
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}

export async function apiDelete(endpoint) {
  startBar();
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  } finally { stopBar(); }
}
