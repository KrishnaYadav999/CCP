import React, { useMemo } from 'react'
import { Users, X } from 'lucide-react'

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
            <select value={form.manager} onChange={(event) => changeManager(event.target.value)} required className="form-input">
              <option value="">Select manager</option>
              {managers.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Operation Head">
            <select value={form.operationHead} onChange={(event) => onChange({ ...form, operationHead: event.target.value })} className="form-input">
              <option value="">Optional</option>
              {activeUsers.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
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
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}
