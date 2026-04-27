const API_BASE = 'http://localhost:4000/api';

function authHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

export const api = {
  getCourthouses: () => request('/courthouses'),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  getProfile: (token) => request('/profile/me', { token }),
  updateProfile: (token, data) => request('/profile/me', { method: 'PUT', token, body: data }),
  requestBarVerification: (token, notes) =>
    request('/profile/me/bar-verification-request', { method: 'POST', token, body: { notes } }),
  manualBarVerification: (token, payload) =>
    request('/profile/bar-verification/manual', { method: 'POST', token, body: payload }),
  getFirmMembers: (token) => request('/profile/firm-members', { token }),
  getLawyers: (token, courthouse) =>
    request(`/profile/lawyers${courthouse ? `?courthouse=${encodeURIComponent(courthouse)}` : ''}`, { token }),
  createTask: (token, data) => request('/tasks', { method: 'POST', token, body: data }),
  getOpenTasks: (token, courthouse) =>
    request(`/tasks/open${courthouse ? `?courthouse=${encodeURIComponent(courthouse)}` : ''}`, { token }),
  getMyTasks: (token) => request('/tasks/mine', { token }),
  acceptTask: (token, taskId) => request(`/tasks/${taskId}/accept`, { method: 'POST', token }),
  completeTask: (token, taskId) => request(`/tasks/${taskId}/complete`, { method: 'POST', token }),
  createSecondChairRequest: (token, data) => request('/second-chair', { method: 'POST', token, body: data }),
  getOpenSecondChairRequests: (token) => request('/second-chair/open', { token }),
  getMySecondChairRequests: (token) => request('/second-chair/mine', { token }),
  acceptSecondChairRequest: (token, requestId) =>
    request(`/second-chair/${requestId}/accept`, { method: 'POST', token }),
};
