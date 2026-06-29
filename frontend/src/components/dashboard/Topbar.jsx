import React, { useState } from 'react'
import { Bell, Info, LogOut, Menu, PlugZap, UserRound } from 'lucide-react'
import { roleLabels } from '../../constants/dashboard'

export default function Topbar({ currentUser, onOpenProfile, onOpenSidebar, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = (currentUser?.name || currentUser?.email || 'P').slice(0, 1).toUpperCase()

  function handleProfile() {
    setMenuOpen(false)
    onOpenProfile()
  }

  function handleLogout() {
    setMenuOpen(false)
    onLogout()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="btn-lift inline-flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = 'https://ananttattva.com/'
            }}
            className="btn-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 sm:px-5"
          >
            <PlugZap className="h-5 w-5" />
            <span className="hidden sm:inline">CRM Connect</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <IconButton icon={Info} label="Help" />
          <IconButton icon={Bell} label="Notifications" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="btn-lift flex items-center gap-3 rounded-full border border-transparent px-1.5 py-1.5 transition hover:border-teal-100 hover:bg-teal-50"
              aria-expanded={menuOpen}
              aria-label="Open account menu"
            >
              <div className="hidden text-right sm:block">
                <p className="font-black text-slate-900">{currentUser?.name || 'CCP User'}</p>
                <p className="text-sm font-semibold text-slate-500">{roleLabels[currentUser?.role] || 'Consultant'}</p>
              </div>
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-teal-700 to-sky-600 font-black text-white shadow-lg shadow-teal-700/20 ring-4 ring-teal-50">
                {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser?.name || 'User'} className="h-full w-full object-cover" /> : initial}
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-14 z-40 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-900/15">
                <div className="flex items-center gap-4 bg-gradient-to-br from-teal-50 to-white p-4">
                  <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-teal-700 to-sky-600 text-xl font-black text-white shadow-lg shadow-teal-700/20">
                    {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser?.name || 'User'} className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{currentUser?.name || 'CCP User'}</p>
                    <p className="truncate text-sm font-bold text-slate-500">{currentUser?.email}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-teal-700">{roleLabels[currentUser?.role] || currentUser?.role}</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  <button
                    type="button"
                    onClick={handleProfile}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-black text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function IconButton({ icon: Icon, label }) {
  return (
    <button
      type="button"
      className="btn-lift inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-teal-50 hover:text-teal-700"
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
