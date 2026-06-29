import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import api, { getApiErrorMessage } from '../services/api'

export default function VerifyOtp(){
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || localStorage.getItem('login_email') || ''
  const password = location.state?.password || ''
  const [devOtp, setDevOtp] = useState(import.meta.env.DEV ? localStorage.getItem('dev_otp') || '' : '')

  async function handleVerify(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try{
      if (!password) {
        setError('Session expired. Please login again.')
        return
      }
      const res = await api.post('/auth/verify-otp', { email, password, otp })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/dashboard')
    }catch(err){
      console.error(err)
      setError(getApiErrorMessage(err, 'Invalid OTP'))
    }finally{ setLoading(false) }
  }

  async function handleResend(){
    setResending(true)
    setError('')
    setNotice('')
    try{
      if (!password) {
        setError('Session expired. Please login again.')
        return
      }
      const res = await api.post('/auth/resend-otp', { email, password })
      if (import.meta.env.DEV && res.data?.devOtp) {
        localStorage.setItem('dev_otp', res.data.devOtp)
        setDevOtp(res.data.devOtp)
      } else {
        localStorage.removeItem('dev_otp')
        setDevOtp('')
      }
      setOtp('')
      setNotice(res.data?.message || 'OTP resent successfully.')
    }catch(err){
      console.error(err)
      setError(getApiErrorMessage(err, 'Unable to resend OTP'))
    }finally{ setResending(false) }
  }

  return (
    <AuthLayout
      eyebrow="OTP verification"
      title="Enter secure OTP"
      subtitle={`Enter the 6-digit code sent to ${email || 'your email address'}.`}
    >
      <form onSubmit={handleVerify} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-black text-slate-700">Login OTP</span>
          <div className="group mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 shadow-sm transition duration-300 focus-within:-translate-y-0.5 focus-within:border-emerald-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600 transition duration-300 group-focus-within:scale-110" />
            <input
              type="text"
              inputMode="numeric"
              maxLength="6"
              placeholder="000000"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="min-w-0 flex-1 bg-transparent text-2xl font-black tracking-[0.35em] outline-none placeholder:text-slate-300"
            />
          </div>
        </label>
        {devOtp && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Development OTP: {devOtp}</p>}
        {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button className="btn-lift relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/20 transition disabled:cursor-not-allowed disabled:opacity-70" disabled={loading || resending || !password}>
          <span className="relative">{loading ? 'Verifying...' : 'Verify and login'}</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || resending || !password}
            className="btn-lift inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? 'Resending OTP...' : 'Resend OTP'}
          </button>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-900">
            <ArrowLeft className="h-4 w-4" />
            Use a different email
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
