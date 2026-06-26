import axios from 'axios'

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

export default api
