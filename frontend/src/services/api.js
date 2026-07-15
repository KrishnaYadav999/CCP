import axios from 'axios'
import apiEndpoints from './apiEndpoints'

const defaultBaseURL = import.meta.env.DEV ? 'http://localhost:8081/api' : '/api'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
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
      apiEndpoints.auth.verifyOtp
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
    getUsers: () => api.get(apiEndpoints.auth.users),
    getAdminUsers: () => api.get(apiEndpoints.auth.adminUsers),
    createAdminUser: (payload) => api.post(apiEndpoints.auth.adminCreateUser, payload),
    updateAdminUser: (id, payload) => api.put(apiEndpoints.auth.adminUser(id), payload)
  },
  leads: {
    getList: () => api.get(apiEndpoints.leads.list),
    bulkImport: (leads) => api.post(apiEndpoints.leads.bulk, { leads }),
    create: (payload) => api.post(apiEndpoints.leads.list, payload),
    update: (id, payload) => api.put(apiEndpoints.leads.detail(id), payload)
  },
  clients: {
    getList: () => api.get(apiEndpoints.clients.list),
    bulkImport: (clients) => api.post(apiEndpoints.clients.bulk, { clients }),
    create: (payload) => api.post(apiEndpoints.clients.list, payload),
    update: (id, payload) => api.put(apiEndpoints.clients.detail(id), payload),
    updateYears: (id, payload) => api.patch(apiEndpoints.clients.years(id), payload)
  },
  quotations: {
    getList: () => api.get(apiEndpoints.quotations.list),
    save: (payload) => api.post(apiEndpoints.quotations.list, payload),
    bulkUpsert: (quotations) => api.post(apiEndpoints.quotations.bulk, { quotations })
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
  }
}

export default api
