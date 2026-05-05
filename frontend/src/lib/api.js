const BASE = '/api/v1'

function getToken() {
  return localStorage.getItem('token')
}

async function request(path, opts = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    return
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
  return data
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  // Health
  health: () => request('/health'),

  // Dashboard / monitor
  monitorQueue: () => request('/monitor/queue'),
  monitorLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/monitor/logs${q ? '?' + q : ''}`)
  },

  // Contacts
  listContacts: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/contacts${q ? '?' + q : ''}`)
  },
  createContact: (data) => request('/contacts', { method: 'POST', body: data }),
  importContacts: (data) => request('/contacts/import', { method: 'POST', body: data }),
  optOut: (phone) => request(`/contacts/${encodeURIComponent(phone)}/opt-out`, { method: 'POST' }),

  // Templates
  listTemplates: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/templates${q ? '?' + q : ''}`)
  },
  createTemplate: (data) => request('/templates', { method: 'POST', body: data }),
  approveTemplate: (id) => request(`/templates/${id}/approve`, { method: 'PATCH' }),

  // Campaigns
  listCampaigns: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/campaigns${q ? '?' + q : ''}`)
  },
  createCampaign: (data) => request('/campaigns', { method: 'POST', body: data }),
  launchCampaign: (id, data = {}) =>
    request(`/campaigns/${id}/launch`, { method: 'POST', body: data }),
  pauseCampaign: (id) => request(`/campaigns/${id}/pause`, { method: 'POST' }),
  getCampaignStats: (id) => request(`/campaigns/${id}/stats`),

  // Messages
  scheduleMessage: (data) => request('/messages', { method: 'POST', body: data }),
  listMessages: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/messages${q ? '?' + q : ''}`)
  },

  // Import CSV
  importCSV: (data) => request('/import/csv', { method: 'POST', body: data }),

  // WhatsApp
  whatsappStatus: () => request('/whatsapp/status'),
  whatsappSetup: () => request('/whatsapp/setup', { method: 'POST' }),
}
