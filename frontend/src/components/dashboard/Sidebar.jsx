import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, X } from 'lucide-react'
import { brand } from '../../constants/brand'
import { navSections } from '../../constants/dashboard'

export default function Sidebar({ collapsed, onToggleCollapsed, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [openGroups, setOpenGroups] = useState({ Home: true })

  function openItem(item) {
    if (item.children) {
      setOpenGroups((current) => ({ ...current, [item.label]: !current[item.label] }))
      return
    }
    if (item.href) {
      window.location.href = item.href
      return
    }
    if (item.path) {
      navigate(item.path)
      onClose?.()
    }
  }

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-visible bg-[#0b664e] text-white">
      <div className={`min-h-[74px] bg-white px-4 py-3 text-slate-950 ${collapsed ? 'flex justify-center' : 'flex items-center justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <img src={brand.logoUrl} alt="Anant Tattva" className="h-full w-full object-contain" />
          </div>
          <div className={`min-w-0 transition-all duration-200 ${collapsed ? 'hidden opacity-0' : 'block opacity-100'}`}>
            <p className="text-lg font-black leading-tight text-slate-950">e-Connect</p>
            <p className="mt-0.5 truncate text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">Anant Tattva</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className="btn-lift absolute -right-5 top-[88px] z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#09533f] text-white shadow-lg shadow-slate-950/20 transition hover:bg-[#084635] lg:inline-flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronsLeft className={`h-5 w-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <nav className={`flex-1 py-7 ${collapsed ? 'px-2' : 'px-4'}`}>
        {navSections.map((section) => (
          <div key={section.label} className="mb-7 last:mb-0">
            {!collapsed && (
              <p className="mb-4 px-1 text-xs font-black uppercase tracking-[0.22em] text-[#80c5b2]">
                {section.label}
              </p>
            )}
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const currentLocation = `${location.pathname}${location.search}`
                const isActive = item.path === currentLocation || (!item.path?.includes('?') && item.path === location.pathname)
                const isGroupOpen = Boolean(openGroups[item.label])
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`group relative flex min-h-12 w-full items-center rounded-2xl text-left font-black transition-all duration-200 ${collapsed ? 'justify-center px-0' : 'gap-2 px-3'} ${isActive ? 'bg-[#ff5108] text-white shadow-lg shadow-orange-950/15' : item.children && isGroupOpen ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${isActive ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${collapsed ? 'sr-only' : ''}`}>{item.label}</span>
                      {item.children && !collapsed && <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`} />}
                    </button>

                    {item.children && isGroupOpen && !collapsed && (
                      <div className="ml-6 mt-1 space-y-1 border-l border-white/20 py-1 pl-3">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const childLocation = `${location.pathname}${location.search}`
                          const isChildActive = child.path === childLocation || (
                            child.path === location.pathname && !location.search
                          )
                          return (
                            <button
                              key={child.label}
                              type="button"
                              onClick={() => openItem(child)}
                              className={`group flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-black transition ${isChildActive ? 'bg-[#ff5108] text-white shadow-lg shadow-orange-950/20' : 'text-white/85 hover:bg-[#ff5108] hover:text-white hover:shadow-lg'}`}
                              aria-current={isChildActive ? 'page' : undefined}
                            >
                              <span className="grid h-8 w-8 place-items-center"><ChildIcon className="h-4 w-4" /></span>
                              <span>{child.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
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
