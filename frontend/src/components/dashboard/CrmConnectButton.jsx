import React from 'react'
import { PlugZap } from 'lucide-react'

export const CRM_CONNECT_URL = import.meta.env.VITE_CRM_APP_URL || 'http://localhost:6173/dashboard'

export default function CrmConnectButton({ className = '' }) {
  return (
    <button
      type="button"
      onClick={() => window.location.assign(CRM_CONNECT_URL)}
      className={`btn-lift inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0b664e] to-[#13877a] px-5 py-3 font-black text-white shadow-lg shadow-emerald-800/20 transition hover:brightness-105 ${className}`}
    >
      <PlugZap className="h-5 w-5" />
      CRM Connect
    </button>
  )
}
