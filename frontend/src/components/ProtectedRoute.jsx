import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState({ loading: true, allowed: false })

  useEffect(() => {
    api.get('/auth/me')
      .then(() => setState({ loading: false, allowed: true }))
      .catch(() => {
        localStorage.removeItem('token')
        setState({ loading: false, allowed: false })
      })
  }, [])

  if (state.loading) {
    return <div className="grid min-h-screen place-items-center bg-emerald-50 font-bold text-emerald-700">Loading CCP...</div>
  }

  return state.allowed ? children : <Navigate to="/" replace />
}
