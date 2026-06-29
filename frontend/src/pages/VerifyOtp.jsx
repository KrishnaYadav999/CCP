import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import api, { getApiErrorMessage } from '../services/api'

export default function VerifyOtp(){
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendTimer, setResendTimer] = useState(39)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const otpInputRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || localStorage.getItem('login_email') || ''
  const password = location.state?.password || ''
  const [devOtp, setDevOtp] = useState(import.meta.env.DEV ? localStorage.getItem('dev_otp') || '' : '')
  const otpDigits = Array.from({ length: 6 }, (_, index) => otp[index] || '')

  useEffect(() => {
    if (resendTimer <= 0) return undefined
    const timer = window.setTimeout(() => setResendTimer((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendTimer])

  function updateOtp(value) {
    setOtp(value.replace(/\D/g, '').slice(0, 6))
  }

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
      setResendTimer(39)
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
          <div
            role="button"
            tabIndex={0}
            onClick={() => otpInputRef.current?.focus()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') otpInputRef.current?.focus()
            }}
            className="group relative mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition duration-300 focus-within:-translate-y-0.5 focus-within:border-emerald-500 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-100"
          >
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength="6"
              required
              value={otp}
              onChange={(e) => updateOtp(e.target.value)}
              className="sr-only"
            />
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition duration-300 group-focus-within:scale-105 group-focus-within:bg-emerald-600 group-focus-within:text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="grid grid-cols-6 gap-2">
                {otpDigits.map((digit, index) => {
                  const active = otp.length === index
                  const filled = Boolean(digit)
                  return (
                    <span
                      key={index}
                      className={`grid h-12 place-items-center rounded-xl border text-xl font-black transition duration-300 sm:h-14 sm:text-2xl ${
                        active
                          ? 'animate-pulse border-emerald-500 bg-white text-slate-950 shadow-lg shadow-emerald-900/10 ring-4 ring-emerald-100'
                          : filled
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-300'
                      }`}
                    >
                      {digit || '0'}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              <span>{otp.length}/6 digits</span>
              {otp.length === 6 && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Ready</span>}
            </div>
          </div>
        </label>
        {devOtp && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Development OTP: {devOtp}</p>}
        {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button className="btn-lift group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/20 transition disabled:cursor-not-allowed disabled:opacity-70" disabled={loading || resending || !password || otp.length !== 6}>
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition duration-700 group-hover:translate-x-full" />
          <span className="relative">{loading ? 'Verifying...' : 'Verify and login'}</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || resending || !password || resendTimer > 0}
            className="btn-lift inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:opacity-80"
          >
            <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Resending OTP...' : resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
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
