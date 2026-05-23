const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('iga_token');
}

function setToken(token) {
  if (token) localStorage.setItem('iga_token', token);
  else localStorage.removeItem('iga_token');
}

async function api(path, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Сервер недоступен. Запустите: npm start');
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const isLogin = path === '/auth/login';
    if (!isLogin && getToken()) {
      setToken(null);
      window.location.reload();
    }
    throw new Error(data.error || 'Требуется авторизация');
  }

  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

const auth = {
  login: (login, password) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  me: () => api('/auth/me'),
};

const catalog = {
  departments: () => api('/catalog/departments'),
  resources: () => api('/catalog/resources'),
  accessTypes: () => api('/catalog/access-types'),
  approvers: () => api('/catalog/approvers'),
  meta: () => api('/catalog/meta'),
};

const requests = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/requests?${q}`);
  },
  get: (id) => api(`/requests/${id}`),
  create: (data) => api('/requests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    api(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submit: (id) => api(`/requests/${id}/submit`, { method: 'POST' }),
  comment: (id, text) =>
    api(`/requests/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  setApprovers: (id, approver_ids) =>
    api(`/requests/${id}/approvers`, {
      method: 'PUT',
      body: JSON.stringify({ approver_ids }),
    }),
  approve: (id, decision, comment) =>
    api(`/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }),
  resubmit: (id) => api(`/requests/${id}/resubmit`, { method: 'POST' }),
  complete: (id) => api(`/requests/${id}/complete`, { method: 'POST' }),
  close: (id) => api(`/requests/${id}/close`, { method: 'POST' }),
};

const files = {
  upload: (requestId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api(`/files/${requestId}`, { method: 'POST', body: fd });
  },
  downloadUrl: (attachmentId) => `${API_BASE}/files/${attachmentId}/download`,
};

const reports = {
  generate: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/reports?${q}`);
  },
};

window.IGA_API = { auth, catalog, requests, files, reports, getToken, setToken, api };
