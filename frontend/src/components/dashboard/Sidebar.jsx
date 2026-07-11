import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronsLeft, X } from 'lucide-react'
import { brand } from '../../constants/brand'
import { navSections } from '../../constants/dashboard'

export default function Sidebar({ collapsed, onToggleCollapsed, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()

  function openItem(item) {
    if (item.path) {
      navigate(item.path)
      onClose?.()
    }
  }

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-visible bg-[#0f684f] text-white">
      <div className={`border-b border-white/10 px-4 py-5 ${collapsed ? 'flex justify-center' : 'flex items-center justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/20 bg-white p-2 shadow-lg shadow-slate-950/10">
            <img src={brand.logoUrl} alt="Anant Tattva" className="h-full w-full object-contain" />
          </div>
          <div className={`min-w-0 transition-all duration-200 ${collapsed ? 'hidden opacity-0' : 'block opacity-100'}`}>
            <p className="text-xl font-black text-white">{brand.name}</p>
            <p className="mt-0.5 truncate text-xs font-black uppercase tracking-[0.16em] text-white/55">Creator Portal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className="btn-lift absolute -right-5 top-8 z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#095944] text-white shadow-lg shadow-slate-950/20 transition hover:bg-[#084d3c] lg:inline-flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronsLeft className={`h-5 w-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <nav className={`flex-1 py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
        {navSections.map((section) => (
          <div key={section.label} className="mb-7 last:mb-0">
            {!collapsed && (
              <p className="mb-4 px-1 text-xs font-black uppercase tracking-[0.22em] text-[#89cbb8]">
                {section.label}
              </p>
            )}
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.path === location.pathname
                return (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => openItem(item)}
                    className={`group relative flex min-h-12 w-full items-center rounded-2xl text-left font-black transition-all duration-200 ${
                      collapsed ? 'justify-center px-0' : 'gap-2 px-3'
                    } ${
                      isActive
                        ? 'bg-[#ff5108] text-white shadow-lg shadow-slate-950/15'
                        : 'text-white/90 hover:bg-[#347f6b] hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
                      isActive ? 'text-white' : 'text-white/90 group-hover:text-white'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`min-w-0 truncate text-[15px] ${collapsed ? 'sr-only' : ''}`}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="mx-4 mb-5 rounded-xl border border-white/10 bg-white/8 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Connected DB</p>
          <p className="mt-1 font-black text-white">ccp</p>
        </div>
      )}
    </div>
  )
}
