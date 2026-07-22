import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users
} from 'lucide-react'
import AddUserModal from '../components/dashboard/AddUserModal'
import CreateTeamModal from '../components/dashboard/CreateTeamModal'
import EditUserModal from '../components/dashboard/EditUserModal'
import KpiSummary from '../components/dashboard/KpiSummary'
import ProfileModal from '../components/dashboard/ProfileModal'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import UserActionsMenu from '../components/dashboard/UserActionsMenu'
import UserDetailsModal from '../components/dashboard/UserDetailsModal'
import CrmConnectButton from '../components/dashboard/CrmConnectButton'
import { adminRoles, defaultUserForm, roleLabels } from '../constants/dashboard'
import { apiService, getApiErrorMessage } from '../services/api'

function formatDateTime(value) {
  if (!value) return 'No login yet'
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatShortDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || '-'
  }
}

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState(defaultUserForm)
  const [teamForm, setTeamForm] = useState({ name: '', description: '', manager: '', operationHead: '', members: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeActionUser, setActiveActionUser] = useState(null)
  const [detailsUser, setDetailsUser] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState(defaultUserForm)
  const [profileOpen, setProfileOpen] = useState(false)
  const [resyncing, setResyncing] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = new URLSearchParams(location.search).get('section') === 'home'

  const canManageUsers = adminRoles.includes(currentUser?.role)

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.name || ''} ${user.email || ''} ${user.role || ''} ${user.team || ''}`.toLowerCase()
      const matchesSearch = text.includes(query.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive)

      return matchesSearch && matchesStatus
    })
  }, [query, statusFilter, users])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage))
  const visibleUsers = filteredUsers.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const activeUsers = users.filter((user) => user.isActive).length
  const inactiveUsers = users.filter((user) => !user.isActive).length

  const metrics = [
    { label: 'Active Users', value: activeUsers, icon: Users, iconClass: 'bg-teal-100 text-teal-800', valueClass: 'text-teal-700' },
    { label: 'Inactive Users', value: inactiveUsers, icon: UserRound, iconClass: 'bg-red-100 text-red-700', valueClass: 'text-red-600' }
  ]

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (!currentUser) return undefined

    const timer = window.setInterval(() => {
      refreshDashboardData({ silent: true })
    }, 15000)

    return () => window.clearInterval(timer)
  }, [currentUser?._id, currentUser?.id, currentUser?.role])

  useEffect(() => {
    setPage(1)
  }, [query, rowsPerPage, statusFilter])

  async function loadDashboard() {
    await refreshDashboardData({ silent: false })
  }

  async function refreshDashboardData({ silent = false } = {}) {
    if (!silent) {
      setLoading(true)
      setError('')
    }

    try {
      let user = currentUser
      if (!user) {
        const meResponse = await apiService.auth.getMe()
        user = meResponse.data.user
        setCurrentUser(user)
      }

      const [usersResponse, teamsResponse] = await Promise.all([
        adminRoles.includes(user.role) ? apiService.auth.getAdminUsers() : apiService.auth.getUsers(),
        apiService.teams.getList()
      ])

      setUsers(usersResponse.data.users || [])
      setTeams(teamsResponse.data.teams || [])
    } catch (err) {
      if (!silent) {
        setError(getApiErrorMessage(err, 'Unable to load dashboard'))
      } else {
        console.warn('Silent dashboard refresh failed', err)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const name = `${form.firstName} ${form.lastName}`.trim()

    try {
      const response = await apiService.auth.createAdminUser({
        name,
        email: form.email,
        password: form.password,
        avatarUrl: form.avatarUrl,
        role: form.role,
        team: form.team,
        teamId: form.teamId,
        managerId: form.managerId,
        operationHeadId: form.operationHeadId,
        isActive: form.isActive
      })
      setUsers((prevUsers) => [response.data.user, ...prevUsers])
      setForm(defaultUserForm)
      setModalOpen(false)
      setNotice(response.data.crmSync?.ok === false
        ? `New user added in CCP, but CRM sync failed: ${response.data.crmSync.error}`
        : 'New user added successfully. They can login with OTP from the sign-in page.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to create user'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault()
    if (!editingUser) return

    setSaving(true)
    setError('')
    setNotice('')

    const name = `${editForm.firstName} ${editForm.lastName}`.trim()
    const id = editingUser._id || editingUser.id

    try {
      const response = await apiService.auth.updateAdminUser(id, {
        name,
        email: editForm.email,
        avatarUrl: editForm.avatarUrl,
        role: editForm.role,
        team: editForm.team,
        teamId: editForm.teamId,
        managerId: editForm.managerId,
        operationHeadId: editForm.operationHeadId,
        isActive: editForm.isActive
      })
      const updatedUser = response.data.user
      setUsers((prevUsers) =>
        prevUsers.map((user) => ((user._id || user.id) === id ? { ...user, ...updatedUser, _id: updatedUser._id || updatedUser.id || id } : user))
      )
      setEditingUser(null)
      setEditForm(defaultUserForm)
      setNotice(response.data.crmSync?.ok === false
        ? `User updated in CCP, but CRM sync failed: ${response.data.crmSync.error}`
        : 'User updated successfully.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to update user'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await apiService.teams.create(teamForm)
      setTeams((prevTeams) => [response.data.team, ...prevTeams])
      const usersResponse = await apiService.auth.getAdminUsers()
      setUsers(usersResponse.data.users || users)
      setTeamForm({ name: '', description: '', manager: '', operationHead: '', members: [] })
      setTeamModalOpen(false)
      setNotice(response.data.crmSync?.ok === false
        ? `Team created in CCP, but CRM sync failed: ${response.data.crmSync.error}`
        : 'Team created and user mapping updated successfully.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to create team'))
    } finally {
      setSaving(false)
    }
  }

  async function handleResync(type) {
    setResyncing(type)
    setError('')
    setNotice('')

    try {
      const response = await apiService.crm.resync(type)
      await loadDashboard()
      setNotice(`CRM ${type} sync completed. ${response.data.synced || 0} record${response.data.synced === 1 ? '' : 's'} updated.`)
    } catch (err) {
      setError(getApiErrorMessage(err, `Unable to sync CRM ${type}`))
    } finally {
      setResyncing('')
    }
  }

  async function handleUpdateProfile(profile) {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await apiService.auth.updateMe(profile)
      const updatedUser = response.data.user
      setCurrentUser(updatedUser)
      setUsers((prevUsers) =>
        prevUsers.map((user) => ((user._id || user.id) === (updatedUser._id || updatedUser.id) ? { ...user, ...updatedUser } : user))
      )
      setNotice('Profile updated successfully.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to update profile'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdatePassword(passwords) {
    setSaving(true)
    setError('')
    setNotice('')

    try {
      await apiService.auth.updatePassword(passwords)
      setNotice('Password updated successfully.')
    } catch (err) {
      const message = getApiErrorMessage(err, 'Unable to update password')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  function openDetails(user) {
    setActiveActionUser(null)
    setDetailsUser(user)
  }

  function openEdit(user) {
    const name = splitName(user.name)
    setActiveActionUser(null)
    setDetailsUser(null)
    setEditingUser(user)
    setEditForm({
      firstName: name.firstName === '-' ? '' : name.firstName,
      lastName: name.lastName === '-' ? '' : name.lastName,
      email: user.email || '',
      avatarUrl: user.avatarUrl || '',
      role: user.role || 'operation',
      team: user.team || 'No team assigned',
      teamId: user.teamId || '',
      managerId: user.managerId || '',
      operationHeadId: user.operationHeadId || '',
      isActive: Boolean(user.isActive)
    })
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('login_email')
    navigate('/', { replace: true })
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setForm(defaultUserForm)
  }

  function closeTeamModal() {
    if (saving) return
    setTeamModalOpen(false)
    setTeamForm({ name: '', description: '', manager: '', operationHead: '', members: [] })
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-emerald-50 px-6 text-center">
        <div>
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-4 font-black text-emerald-800">Loading CCP...</p>
        </div>
      </div>
    )
  }

  if (isHome) {
    const modules = [
      { title: 'Lead Generator', description: 'Create, import and assign leads from one guided workspace.', path: '/sales/lead-generation', icon: ClipboardList, accent: 'from-orange-500 to-orange-600' },
      { title: 'Client Master Generator', description: 'Build client masters, quotations and compliance records.', path: '/sales/client-master', icon: UserRound, accent: 'from-teal-600 to-cyan-700' },
      { title: 'Admin User Master', description: 'Manage users, teams, roles and CRM synchronization.', path: '/dashboard', icon: Users, accent: 'from-emerald-700 to-green-800' }
    ]

    return (
      <main className="min-h-screen bg-[#eef7f5] text-slate-900">
        <div className="flex min-h-screen">
          <aside className={`fixed inset-y-0 left-0 z-40 w-[296px] transition-all duration-300 lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[296px]'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} onClose={() => setSidebarOpen(false)} />
          </aside>
          {sidebarOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
          <section className={`min-w-0 flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[84px]' : 'lg:ml-[296px]'}`}>
            <Topbar currentUser={currentUser} onOpenProfile={() => setProfileOpen(true)} onOpenSidebar={() => setSidebarOpen(true)} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} sidebarCollapsed={sidebarCollapsed} onLogout={handleLogout} />
            <div className="px-4 py-8 sm:px-6 lg:px-10">
              <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b664e] via-[#087b6d] to-[#178c86] p-7 text-white shadow-xl shadow-emerald-900/15 sm:p-10">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-100">CCP Workspace</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <h1 className="text-3xl font-black sm:text-4xl">Welcome to e-Connect</h1>
                    <p className="mt-3 max-w-2xl font-bold text-emerald-50/90">Choose a CCP module below or open CRM e-Connect directly.</p>
                  </div>
                  <CrmConnectButton className="border border-white/25 bg-none !bg-white !text-emerald-800 shadow-none" />
                </div>
              </div>
              <div className="mt-7 grid gap-5 lg:grid-cols-3">
                {modules.map(({ title, description, path, icon: Icon, accent }) => (
                  <button key={title} type="button" onClick={() => navigate(path)} className="group rounded-[26px] border border-emerald-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/10">
                    <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}><Icon className="h-7 w-7" /></span>
                    <h2 className="mt-6 text-xl font-black text-slate-950">{title}</h2>
                    <p className="mt-2 min-h-12 text-sm font-bold leading-6 text-slate-500">{description}</p>
                    <span className="mt-6 inline-flex items-center gap-2 font-black text-emerald-700">Open module <ArrowLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1" /></span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
        {profileOpen && <ProfileModal user={currentUser} saving={false} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onSave={() => {}} onUpdatePassword={() => {}} />}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#eef7f5] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[296px] border-r border-emerald-100 bg-white shadow-xl shadow-emerald-900/5 transition-all duration-300 ease-out lg:translate-x-0 ${
            sidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[296px]'
          } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar
            currentUser={currentUser}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
            onClose={() => setSidebarOpen(false)}
            onLogout={handleLogout}
          />
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          />
        )}

        <section className={`min-w-0 flex-1 transition-all duration-300 ease-out ${sidebarCollapsed ? 'lg:ml-[84px]' : 'lg:ml-[296px]'}`}>
          <Topbar
            currentUser={currentUser}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            sidebarCollapsed={sidebarCollapsed}
            onLogout={handleLogout}
          />

          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-[28px] bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard?section=home')}
                    className="btn-lift inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                    aria-label="Back"
                    title="Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Admin User Master</p>
                    <h1 className="mt-1 text-3xl font-black text-slate-950">Admin Users</h1>
                  </div>
                </div>

                {canManageUsers && (
                  <div className="flex flex-wrap items-center gap-3">
                    <CrmConnectButton />
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setNotice('')
                        setTeamModalOpen(true)
                      }}
                      className="btn-lift group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-3 font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                    >
                      <Users className="h-5 w-5" />
                      Create Team
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setNotice('')
                        setModalOpen(true)
                      }}
                      className="btn-lift group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-5 py-3 font-black text-white shadow-lg shadow-emerald-700/20 transition"
                    >
                      <Plus className="h-5 w-5 transition duration-300 group-hover:rotate-90" />
                      Create User
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
              {notice && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}

              <KpiSummary metrics={metrics} />

              <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative w-full xl:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search user"
                      className="h-12 w-full rounded-full border border-transparent bg-slate-100 pl-12 pr-4 font-bold outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-11 min-w-[170px] rounded-lg border border-slate-200 bg-white px-4 font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <button
                      type="button"
                      onClick={loadDashboard}
                      className="btn-lift group inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 px-4 font-black text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <RefreshCw className="h-4 w-4 transition duration-300 group-hover:rotate-180" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <span className="font-black text-slate-700">Rows per page</span>
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-black outline-none focus:border-emerald-400"
                  >
                    {[8, 16, 24].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 px-4 pb-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleUsers.map((user) => {
                    const name = splitName(user.name)
                    const userKey = user._id || user.id
                    const displayName = user.name || `${name.firstName} ${name.lastName}`.trim()
                    const role = roleLabels[user.role] || user.role || 'CCP User'
                    const team = user.team || 'No team assigned'
                    const hiredDate = formatShortDate(user.createdAt || user.updatedAt)
                    const initial = (displayName || user.email || 'U').slice(0, 1).toUpperCase()

                    return (
                      <article
                        key={userKey}
                        className={`group relative overflow-visible rounded-2xl border p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-5 ${
                          user.isActive
                            ? 'border-emerald-100 bg-white hover:border-emerald-200 hover:shadow-emerald-900/10'
                            : 'border-red-100 bg-white hover:border-red-200 hover:shadow-red-900/10'
                        }`}
                      >
                        <div className={`absolute inset-x-0 top-0 h-28 rounded-t-2xl ${user.isActive ? 'bg-emerald-50/80' : 'bg-red-50/70'}`} />
                        <div className="relative flex items-start justify-between gap-3">
                          <span className={`inline-flex rounded-xl px-4 py-2 text-sm font-black ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <UserActionsMenu
                            open={activeActionUser === userKey}
                            onToggle={() => setActiveActionUser((value) => (value === userKey ? null : userKey))}
                            onView={() => openDetails(user)}
                            onEdit={() => openEdit(user)}
                            label={`Actions for ${user.email}`}
                          />
                        </div>

                        <div className="relative mt-1 flex flex-col items-center text-center">
                          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-700 to-sky-700 text-4xl font-black text-white shadow-xl shadow-slate-900/15 ring-4 ring-white transition duration-300 group-hover:scale-105">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                              initial
                            )}
                          </div>
                          <h3 className="mt-5 max-w-full truncate text-2xl font-black text-slate-950">{displayName}</h3>
                          <p className="mt-1 max-w-full truncate text-lg font-black text-indigo-600">{role}</p>
                        </div>

                        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-bold text-slate-500">Department</p>
                              <p className="mt-1 break-words font-black text-slate-950">{team}</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-500">Created Date</p>
                              <p className="mt-1 font-black text-slate-950">{hiredDate}</p>
                            </div>
                          </div>

                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="flex min-w-0 items-center gap-3 text-sm font-bold text-slate-600">
                              <Mail className="h-5 w-5 shrink-0 text-indigo-600" />
                              <span className="truncate">{user.email}</span>
                            </p>
                            <p className="mt-3 flex min-w-0 items-center gap-3 text-sm font-bold text-slate-600">
                              <CalendarDays className="h-5 w-5 shrink-0 text-indigo-600" />
                              <span className="truncate">Last login: {formatDateTime(user.lastLogin || user.updatedAt || user.createdAt)}</span>
                            </p>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>

                {visibleUsers.length === 0 && (
                  <div className="px-4 py-12 text-center">
                    <Users className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-black text-slate-700">No users found</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Try another search or status filter.</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-slate-500">
                    Showing {visibleUsers.length} of {filteredUsers.length} users
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="rounded-lg border border-slate-200 px-4 py-2 font-black text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      {modalOpen && (
        <AddUserModal
          form={form}
          saving={saving}
          error={error}
          users={users}
          teams={teams}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={handleCreateUser}
        />
      )}
      {teamModalOpen && (
        <CreateTeamModal
          form={teamForm}
          users={users}
          saving={saving}
          error={error}
          onChange={setTeamForm}
          onClose={closeTeamModal}
          onSubmit={handleCreateTeam}
        />
      )}
      {detailsUser && (
        <UserDetailsModal
          user={detailsUser}
          onClose={() => setDetailsUser(null)}
          onEdit={() => openEdit(detailsUser)}
        />
      )}
      {editingUser && (
        <EditUserModal
          form={editForm}
          saving={saving}
          users={users}
          teams={teams}
          onChange={setEditForm}
          onClose={() => {
            if (saving) return
            setEditingUser(null)
            setEditForm(defaultUserForm)
          }}
          onSubmit={handleUpdateUser}
        />
      )}
      {profileOpen && (
        <ProfileModal
          user={currentUser}
          saving={saving}
          onClose={() => setProfileOpen(false)}
          onLogout={handleLogout}
          onSave={handleUpdateProfile}
          onUpdatePassword={handleUpdatePassword}
        />
      )}
    </main>
  )
}
