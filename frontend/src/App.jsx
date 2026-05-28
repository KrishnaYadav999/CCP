import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import VerifyOtp from './pages/VerifyOtp'
import AdminDashboard from './pages/AdminDashboard'
import LeadGeneration from './pages/LeadGeneration'
import ClientMaster from './pages/ClientMaster'
import ProtectedRoute from './components/ProtectedRoute'

function App(){
  return (
    <div className="min-h-screen bg-emerald-50">
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/verify" element={<VerifyOtp/>} />
        <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard/></ProtectedRoute>} />
        <Route path="/sales/lead-generation" element={<ProtectedRoute><LeadGeneration/></ProtectedRoute>} />
        <Route path="/sales/client-master" element={<ProtectedRoute><ClientMaster/></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
