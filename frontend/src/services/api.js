import axios from 'axios'
import apiEndpoints from './apiEndpoints'

const defaultBaseURL = import.meta.env.DEV ? 'http://localhost:8081/api' : '/api'
const resolvedBaseURL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || defaultBaseURL)

const api = axios.create({
  baseURL: resolvedBaseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = String(error?.config?.url || '')
    const publicAuthEndpoints = [
      apiEndpoints.auth.requestOtp,
      apiEndpoints.auth.resendOtp,
      apiEndpoints.auth.verifyOtp,
      apiEndpoints.auth.forgotPassword,
      apiEndpoints.auth.resetPassword
    ]
    const isLoginRequest = publicAuthEndpoints.some((endpoint) => url.includes(endpoint))

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/') {
        window.location.replace('/')
      }
    }

    return Promise.reject(error)
  }
)

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data
  const candidate = data?.error || data?.message || error?.message

  if (typeof candidate === 'string') return candidate
  if (candidate && typeof candidate === 'object') {
    if (typeof candidate.message === 'string') return candidate.message
    if (typeof candidate.code === 'string') return candidate.code
  }

  return fallback
}

export const apiService = {
  auth: {
    getMe: () => api.get(apiEndpoints.auth.me),
    updateMe: (payload) => api.put(apiEndpoints.auth.updateMe, payload),
    updatePassword: (payload) => api.put(apiEndpoints.auth.updatePassword, payload),
    requestOtp: (payload) => api.post(apiEndpoints.auth.requestOtp, payload),
    resendOtp: (payload) => api.post(apiEndpoints.auth.resendOtp, payload),
    verifyOtp: (payload) => api.post(apiEndpoints.auth.verifyOtp, payload),
    forgotPassword: (payload) => api.post(apiEndpoints.auth.forgotPassword, payload),
    resetPassword: (payload) => api.post(apiEndpoints.auth.resetPassword, payload),
    getUsers: () => api.get(apiEndpoints.auth.users),
    getAdminUsers: () => api.get(apiEndpoints.auth.adminUsers),
    createAdminUser: (payload) => api.post(apiEndpoints.auth.adminCreateUser, payload),
    updateAdminUser: (id, payload) => api.put(apiEndpoints.auth.adminUser(id), payload)
  },
  leads: {
    getList: () => api.get(apiEndpoints.leads.list),
    bulkImport: (leads, options = {}) => api.post(apiEndpoints.leads.bulk, { leads, ...options }),
    create: (payload) => api.post(apiEndpoints.leads.list, payload),
    update: (id, payload) => api.put(apiEndpoints.leads.detail(id), payload)
  },
  clients: {
    getList: () => api.get(apiEndpoints.clients.list),
    bulkImport: (clients) => api.post(apiEndpoints.clients.bulk, { clients }),
    create: (payload) => api.post(apiEndpoints.clients.list, payload),
    update: (id, payload) => api.put(apiEndpoints.clients.detail(id), payload),
    updateYears: (id, payload) => api.patch(apiEndpoints.clients.years(id), payload),
    getAnnualReturn: (id) => api.get(apiEndpoints.clients.annualReturn(id)),
    saveAnnualReturn: (id, payload) => api.put(apiEndpoints.clients.annualReturn(id), payload),
    getAnnualAccess: (id, year) => api.get(apiEndpoints.clients.annualAccess(id, year))
  },
  quotations: {
    getList: () => api.get(apiEndpoints.quotations.list),
    save: (payload) => api.post(apiEndpoints.quotations.list, payload),
    bulkUpsert: (quotations) => api.post(apiEndpoints.quotations.bulk, { quotations }),
    getPiboCategories: () => api.get(apiEndpoints.quotations.piboCategories),
    createPiboCategory: (name, parent) => api.post(apiEndpoints.quotations.piboCategories, { name, parent }),
    getServiceCategories: () => api.get(apiEndpoints.quotations.serviceCategories),
    createServiceCategory: (name) => api.post(apiEndpoints.quotations.serviceCategories, { name })
  },
  teams: {
    getList: () => api.get(apiEndpoints.teams.list),
    create: (payload) => api.post(apiEndpoints.teams.create, payload)
  },
  crm: {
    resync: (type) => api.post(apiEndpoints.crm.resync(type))
  },
  notifications: {
    getList: () => api.get(apiEndpoints.notifications.list),
    markRead: (id) => api.patch(apiEndpoints.notifications.markRead(id)),
    markAllRead: () => api.patch(apiEndpoints.notifications.readAll)
  },
  media: {
    signature: (payload) => api.post(apiEndpoints.media.signature, payload)
  }
}

export async function uploadMedia(file, section = 'general') {
  if (!(file instanceof File)) throw new Error('A file is required');
  const { data } = await apiService.media.signature({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, section });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', data.apiKey);
  Object.entries(data.params || {}).forEach(([key, value]) => form.append(key, String(value)));
  const response = await fetch(data.uploadUrl, { method: 'POST', body: form });
  const uploaded = await response.json();
  if (!response.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || 'Cloudinary upload failed');
  return {
    name: file.name,
    type: file.type || uploaded.resource_type,
    url: uploaded.secure_url,
    secureUrl: uploaded.secure_url,
    storageKey: uploaded.public_id,
    publicId: uploaded.public_id,
    resourceType: uploaded.resource_type,
    format: uploaded.format || '',
    size: uploaded.bytes || file.size,
    width: uploaded.width,
    height: uploaded.height,
    duration: uploaded.duration,
    uploadedAt: uploaded.created_at || new Date().toISOString(),
    provider: 'cloudinary'
  };
}

export const uploadMediaFiles = (files, section) => Promise.all([...files].map((file) => uploadMedia(file, section)));

export default api
