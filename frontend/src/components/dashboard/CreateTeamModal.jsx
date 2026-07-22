import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, Users, X } from 'lucide-react'

export default function CreateTeamModal({ form, users = [], saving, error, onChange, onClose, onSubmit }) {
  const activeUsers = users.filter((user) => user.isActive)
  const managers = activeUsers.filter((user) => ['manager', 'admin', 'superadmin', 'operation'].includes(user.role))

  const managerMembers = useMemo(() => {
    if (!form.manager) return []

    return activeUsers.filter((user) => {
      const userId = String(user._id || user.id || '')
      return userId !== String(form.manager) && String(user.managerId || '') === String(form.manager)
    })
  }, [activeUsers, form.manager])

  function toggleMember(userId) {
    const members = form.members.includes(userId)
      ? form.members.filter((id) => id !== userId)
      : [...form.members, userId]

    onChange({ ...form, members })
  }

  function changeManager(manager) {
    onChange({ ...form, manager, members: [] })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4 py-6">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Create Team</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Assign manager, optional operation head, and mapped members.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50" aria-label="Close team modal" title="Close">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field label="Team Name">
            <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} required className="form-input" />
          </Field>

          <Field label="Manager">
            <UserDropdown value={form.manager} users={managers} placeholder="Select manager" required onChange={changeManager} />
          </Field>

          <Field label="Operation Head">
            <UserDropdown value={form.operationHead} users={activeUsers} placeholder="Optional" allowEmpty onChange={(operationHead) => onChange({ ...form, operationHead })} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(event) => onChange({ ...form, description: event.target.value })}
                className="form-input min-h-[88px] resize-y py-3"
              />
            </Field>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-black text-slate-700">Members</p>
          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {!form.manager && <EmptyState text="Select manager first." />}
            {form.manager && managerMembers.length === 0 && <EmptyState text="No active users are mapped under this manager yet." />}
            {managerMembers.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {managerMembers.map((user) => {
                  const userId = user._id || user.id
                  return (
                    <label key={userId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:ring-emerald-200">
                      <input
                        type="checkbox"
                        checked={form.members.includes(userId)}
                        onChange={() => toggleMember(userId)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{user.name || user.email}</span>
                        <span className="block truncate text-xs font-semibold text-slate-500">{user.email}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-slate-200 px-7 font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-emerald-700 px-8 font-black text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70">
            {saving ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl bg-white px-4 text-center">
      <div>
        <Users className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 font-black text-slate-600">{text}</p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function UserDropdown({ value, users, placeholder, allowEmpty = false, required = false, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const selected = users.find((user) => String(user._id || user.id) === String(value))
  const filtered = users.filter((user) => `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  function choose(nextValue) {
    onChange(nextValue)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      {required && <input className="pointer-events-none absolute h-px w-px opacity-0" value={value} onChange={() => {}} required tabIndex={-1} />}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`form-input flex items-center justify-between gap-3 text-left transition ${open ? 'border-emerald-400 ring-4 ring-emerald-100' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`min-w-0 truncate ${selected ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>
          {selected?.name || selected?.email || placeholder}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180 text-emerald-700' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-slate-900/20">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user..." className="h-10 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-sm font-bold outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-2" role="listbox">
            {allowEmpty && (
              <button type="button" onClick={() => choose('')} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${!value ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                Optional {!value && <Check className="h-4 w-4" />}
              </button>
            )}
            {filtered.map((user) => {
              const userId = String(user._id || user.id)
              const active = userId === String(value)
              return (
                <button key={userId} type="button" onClick={() => choose(userId)} className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-[#ff5108] text-white shadow-sm' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'}`} role="option" aria-selected={active}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black ${active ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800'}`}>{String(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{user.name || user.email}</span><span className={`block truncate text-xs font-semibold ${active ? 'text-white/75' : 'text-slate-400'}`}>{user.email}</span></span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              )
            })}
            {!filtered.length && <p className="px-3 py-6 text-center text-sm font-bold text-slate-400">No matching user found</p>}
          </div>
        </div>
      )}
    </div>
  )
}
