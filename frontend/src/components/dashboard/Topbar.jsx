import React, { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Info, LogOut, Menu, UserRound, X } from 'lucide-react'
import { roleLabels } from '../../constants/dashboard'
import { apiService } from '../../services/api'

export default function Topbar({ currentUser, onOpenProfile, onOpenSidebar, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const previousUnreadCount = useRef(0)
  const loadedNotifications = useRef(false)
  const initial = (currentUser?.name || currentUser?.email || 'P').slice(0, 1).toUpperCase()

  useEffect(() => {
    if (!currentUser) return undefined

    loadNotifications()
    const timer = window.setInterval(loadNotifications, 45000)
    return () => window.clearInterval(timer)
  }, [currentUser?._id, currentUser?.id])

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.2)
    } catch {
      // Browsers can block generated audio before user interaction.
    }
  }

  async function loadNotifications() {
    try {
      const response = await apiService.notifications.getList()
      const nextCount = Number(response.data.unreadCount || 0)
      setNotifications(response.data.notifications || [])
      setUnreadCount(nextCount)
      if (loadedNotifications.current && nextCount > previousUnreadCount.current) {
        playNotificationSound()
      }
      previousUnreadCount.current = nextCount
      loadedNotifications.current = true
    } catch {
      setNotifications([])
      setUnreadCount(0)
    }
  }

  async function markRead(id) {
    try {
      await apiService.notifications.markRead(id)
      await loadNotifications()
    } catch {
      // Keep the menu responsive even if a stale notification disappears server-side.
    }
  }

  async function markAllRead() {
    try {
      await apiService.notifications.markAllRead()
      await loadNotifications()
    } catch {
      // No-op.
    }
  }

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

        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <IconButton icon={Info} label="Help" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              className="btn-lift relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-teal-50 hover:text-teal-700"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-black text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-14 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-900/15">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">Notifications</p>
                    <p className="mt-1 font-black text-slate-950">{unreadCount} active alert{unreadCount === 1 ? '' : 's'}</p>
                  </div>
                  <button type="button" onClick={() => setNotificationsOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white" aria-label="Close notifications" title="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto p-3">
                  {notifications.length === 0 && (
                    <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                      <p className="font-black text-slate-600">No notifications</p>
                    </div>
                  )}
                  {notifications.map((notification) => (
                    <button
                      key={notification._id || notification.id}
                      type="button"
                      onClick={() => markRead(notification._id || notification.id)}
                      className="mb-2 w-full rounded-xl bg-slate-50 px-4 py-3 text-left transition hover:bg-teal-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{notification.title}</p>
                          {notification.description && <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{notification.description}</p>}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-black uppercase text-teal-700 ring-1 ring-teal-100">{notification.kind}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end border-t border-slate-100 p-3">
                  <button type="button" onClick={markAllRead} className="btn-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 font-black text-white shadow-lg shadow-teal-700/20">
                    <CheckCheck className="h-4 w-4" />
                    Mark all read
                  </button>
                </div>
              </div>
            )}
          </div>
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
