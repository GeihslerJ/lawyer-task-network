const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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
  deactivateMyAccount: (token, password) => request('/profile/me', { method: 'DELETE', token, body: { password } }),
  setUserActiveStatus: (token, userId, isActive) =>
    request(`/profile/admin/users/${userId}/status`, { method: 'POST', token, body: { isActive } }),
  requestBarVerification: (token, notes) =>
    request('/profile/me/bar-verification-request', { method: 'POST', token, body: { notes } }),
  manualBarVerification: (token, payload) =>
    request('/profile/bar-verification/manual', { method: 'POST', token, body: payload }),
  getVerificationQueue: (token) => request('/profile/bar-verification/queue', { token }),
  getActivityLogs: (token, limit = 50) => request(`/profile/activity-logs?limit=${limit}`, { token }),
  getFirmMembers: (token) => request('/profile/firm-members', { token }),
  getLawyers: (token, courthouse, verifiedOnly = false) => {
    const params = new URLSearchParams();
    if (courthouse) params.set('courthouse', courthouse);
    if (verifiedOnly) params.set('verifiedOnly', 'true');
    const query = params.toString();
    return request(`/profile/lawyers${query ? `?${query}` : ''}`, { token });
  },
  rateLawyer: (token, payload) => request('/profile/ratings', { method: 'POST', token, body: payload }),
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
