import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import VerifyOtp from './pages/VerifyOtp'
import ForgotPassword from './pages/ForgotPassword'
import AdminDashboard from './pages/AdminDashboard'
import LeadGeneration from './pages/LeadGeneration'
import ClientMaster from './pages/ClientMaster'
import CreateQuotation from './pages/CreateQuotation'
import ClientAnnualReturns, { ClientDataProcessing } from './pages/ClientAnnualReturns'
import ProtectedRoute from './components/ProtectedRoute'
import { brand } from './constants/brand'

function App(){
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 1700)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-emerald-50">
      {booting && <AppLoader />}
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/verify" element={<VerifyOtp/>} />
        <Route path="/forgot-password" element={<ForgotPassword/>} />
        <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard/></ProtectedRoute>} />
        <Route path="/sales/lead-generation" element={<ProtectedRoute><LeadGeneration/></ProtectedRoute>} />
        <Route path="/sales/client-master" element={<ProtectedRoute><ClientMaster/></ProtectedRoute>} />
        <Route path="/client-master" element={<ProtectedRoute><ClientMaster/></ProtectedRoute>} />
        <Route path="/sales/quotations/new" element={<ProtectedRoute><CreateQuotation/></ProtectedRoute>} />
        <Route path="/sales/client-annual-returns/:clientKey" element={<ProtectedRoute><ClientAnnualReturns/></ProtectedRoute>} />
        <Route path="/sales/client-data-processing/:clientKey/:annualYear" element={<ProtectedRoute><ClientDataProcessing/></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function AppLoader() {
  return (
    <div className="app-loader" role="status" aria-label="Loading CCP">
      <div className="app-loader-grid" />
      <div className="app-loader-card">
        <div className="app-loader-logo">
          <img src={brand.logoUrl} alt="Anant Tattva" />
        </div>
        <div className="text-center">
          <p className="app-loader-eyebrow">Anant Tattva</p>
          <h1 className="app-loader-title">{brand.name}</h1>
          <p className="app-loader-subtitle">Central creator portal</p>
        </div>
        <div className="app-loader-track">
          <span />
        </div>
      </div>
    </div>
  )
}

export default App
