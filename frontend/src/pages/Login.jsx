import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { apiService, getApiErrorMessage } from '../services/api'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    try{
      const res = await apiService.auth.requestOtp({ email, password })
      localStorage.setItem('login_email', email)
      if (import.meta.env.DEV && res.data?.devOtp) {
        localStorage.setItem('dev_otp', res.data.devOtp)
      } else {
        localStorage.removeItem('dev_otp')
      }
      navigate('/verify', { state: { email, password } })
    }catch(err){
      console.error(err)
      setError(getApiErrorMessage(err, 'Unable to send OTP'))
    }finally{ setLoading(false) }
  }

  return (
    <AuthLayout
      eyebrow="Admin approved login"
      title="Sign in to CCP"
      subtitle="Enter your registered work email and password. We will send a secure one-time code for this session."
    >
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-black text-slate-700">Work email</span>
          <div className="group mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 shadow-sm transition duration-300 focus-within:-translate-y-0.5 focus-within:border-emerald-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-100">
            <Mail className="h-5 w-5 text-emerald-600 transition duration-300 group-focus-within:scale-110" />
            <input
              type="email"
              placeholder="name@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-black text-slate-700">Password</span>
          <div className="group relative mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 shadow-sm transition duration-300 focus-within:-translate-y-0.5 focus-within:border-emerald-500 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-emerald-900/10 focus-within:ring-4 focus-within:ring-emerald-100">
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-sky-500 opacity-0 transition duration-300 group-focus-within:opacity-100" />
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition duration-300 group-focus-within:scale-105 group-focus-within:bg-emerald-600 group-focus-within:text-white">
              <KeyRound className="h-5 w-5" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </label>
        <div className="-mt-2 text-right">
          <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm font-black text-emerald-700 transition hover:text-emerald-900 hover:underline">
            Forgot password?
          </button>
        </div>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button className="btn-lift group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/20 transition disabled:cursor-not-allowed disabled:opacity-70" disabled={loading}>
          <span className="absolute inset-0 -translate-x-full bg-white/20 transition duration-700 group-hover:translate-x-full" />
          <span className="relative">{loading ? 'Sending OTP...' : 'Send OTP'}</span>
          <ArrowRight className="relative h-5 w-5 transition duration-300 group-hover:translate-x-1" />
        </button>
      </form>
    </AuthLayout>
  )
}
