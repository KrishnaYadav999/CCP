import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import AuthLayout from '../components/AuthLayout'
import { apiService, getApiErrorMessage } from '../services/api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function requestCode(event) {
    event.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const response = await apiService.auth.forgotPassword({ email })
      if (import.meta.env.DEV && response.data?.devOtp) setOtp(response.data.devOtp)
      setMessage(response.data?.message || 'Check your email for the reset code.')
      setStep('reset')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to send reset code'))
    } finally { setLoading(false) }
  }

  async function resetPassword(event) {
    event.preventDefault()
    setError(''); setMessage('')
    if (newPassword !== confirmPassword) return setError('Password confirmation does not match')
    setLoading(true)
    try {
      const response = await apiService.auth.resetPassword({ email, otp, newPassword, confirmPassword })
      setMessage(response.data?.message || 'Password reset successfully.')
      window.setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to reset password'))
    } finally { setLoading(false) }
  }

  const inputWrap = 'group mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 shadow-sm transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100'

  return (
    <AuthLayout eyebrow="Secure account recovery" title="Reset your password" subtitle={step === 'request' ? 'Enter your registered work email to receive a 6-digit reset code.' : 'Enter the code from your email and choose a new password.'}>
      <form onSubmit={step === 'request' ? requestCode : resetPassword} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-black text-slate-700">Work email</span>
          <div className={inputWrap}><Mail className="h-5 w-5 text-emerald-600" /><input type="email" required disabled={step === 'reset'} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="min-w-0 flex-1 bg-transparent font-semibold outline-none disabled:text-slate-500" /></div>
        </label>
        {step === 'reset' && <>
          <label className="block"><span className="text-sm font-black text-slate-700">6-digit reset code</span><div className={inputWrap}><KeyRound className="h-5 w-5 text-emerald-600" /><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="min-w-0 flex-1 bg-transparent font-semibold tracking-[0.25em] outline-none" /></div></label>
          <label className="block"><span className="text-sm font-black text-slate-700">New password</span><div className={inputWrap}><KeyRound className="h-5 w-5 text-emerald-600" /><input type={showPassword ? 'text' : 'password'} minLength="8" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" className="min-w-0 flex-1 bg-transparent font-semibold outline-none" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="text-slate-500">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
          <label className="block"><span className="text-sm font-black text-slate-700">Confirm new password</span><div className={inputWrap}><KeyRound className="h-5 w-5 text-emerald-600" /><input type={showPassword ? 'text' : 'password'} minLength="8" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className="min-w-0 flex-1 bg-transparent font-semibold outline-none" /></div></label>
        </>}
        {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 px-5 py-4 font-black text-white shadow-xl disabled:opacity-70"><span>{loading ? 'Please wait...' : step === 'request' ? 'Send reset code' : 'Reset password'}</span><ArrowRight className="h-5 w-5" /></button>
        <div className="flex items-center justify-between text-sm font-black text-emerald-700">
          <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</button>
          {step === 'reset' && <button type="button" onClick={() => { setStep('request'); setMessage(''); setError('') }} className="hover:underline">Use another email</button>}
        </div>
      </form>
    </AuthLayout>
  )
}
