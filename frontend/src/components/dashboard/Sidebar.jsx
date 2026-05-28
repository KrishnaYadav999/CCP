import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, X } from 'lucide-react'
import { brand } from '../../constants/brand'
import { navSections } from '../../constants/dashboard'

export default function Sidebar({ collapsed, onToggleCollapsed, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [openGroups, setOpenGroups] = useState({ Home: true, Sales: true })
  const [activeFlyout, setActiveFlyout] = useState(null)
  const [activeItem, setActiveItem] = useState('User Management')

  function toggleGroup(item, hasChildren) {
    const label = item.label
    setActiveItem(label)
    if (item.path) {
      navigate(item.path)
      onClose?.()
    }

    if (!hasChildren) return

    if (collapsed) {
      setActiveFlyout((value) => (value === label ? null : label))
      return
    }

    setOpenGroups((value) => ({ ...value, [label]: !value[label] }))
  }

  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-visible bg-[#30737B] text-white">
      <div className={`flex items-center px-4 py-5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white p-2 shadow-lg shadow-slate-950/10">
            <img src={brand.logoUrl} alt="Anant Tattva" className="h-full w-full object-contain" />
          </div>
          <div className={`min-w-0 transition-all duration-200 ${collapsed ? 'hidden opacity-0' : 'block opacity-100'}`}>
            <p className="text-xl font-black text-white">{brand.name}</p>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Success CRM</p>
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
        className="btn-lift absolute -right-5 top-8 z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white text-[#30737B] shadow-lg shadow-slate-950/20 transition hover:bg-emerald-50 lg:inline-flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronsLeft className={`h-5 w-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <nav className={`mt-3 flex-1 space-y-3 px-3 pb-5 ${collapsed ? 'overflow-visible px-2' : 'overflow-y-auto px-4'}`}>
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && <p className="mb-2 px-3 text-xs font-black uppercase tracking-[0.18em] text-white/45">{section.label}</p>}
            <div className="space-y-2">
              {section.items.map((item) => {
                const Icon = item.icon
                const isOpen = Boolean(openGroups[item.label])
                const hasChildren = Boolean(item.children?.length)
                const isFlyoutOpen = activeFlyout === item.label
                const isPrimaryActive =
                  activeItem === item.label ||
                  item.path === location.pathname ||
                  Boolean(item.children?.some((child) => child.label === activeItem || child.path === location.pathname))
                return (
                  <div key={item.label} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item, hasChildren)}
                      className={`group flex min-h-12 w-full items-center rounded-xl text-left font-black transition-all duration-200 ${
                        collapsed ? 'justify-center px-0' : 'justify-between px-3'
                      } ${
                        isPrimaryActive
                          ? 'bg-white text-[#30737B] shadow-xl shadow-slate-950/15'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                      aria-expanded={hasChildren ? (collapsed ? isFlyoutOpen : isOpen) : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
                      </span>
                      {hasChildren && !collapsed && (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {hasChildren && !collapsed && (
                      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="mt-2 space-y-1 pl-6">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon
                              const isChildActive = activeItem === child.label
                              return (
                                <button
                                  type="button"
                                  key={child.label}
                                  onClick={() => {
                                    setActiveItem(child.label)
                                    if (child.path) {
                                      navigate(child.path)
                                      onClose?.()
                                    }
                                  }}
                                  className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-black transition ${
                                    isChildActive || child.path === location.pathname
                                      ? 'bg-white/18 text-white'
                                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                                  }`}
                                >
                                  <ChildIcon className="h-4 w-4 shrink-0" />
                                  {child.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasChildren && collapsed && isFlyoutOpen && (
                      <div className="absolute left-[68px] top-0 z-50 w-56 rounded-xl border border-slate-100 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-900/15">
                        <div className="px-3 py-2 font-black text-slate-900">{item.label}</div>
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const isChildActive = activeItem === child.label
                          return (
                            <button
                              type="button"
                              key={child.label}
                              onClick={() => {
                                setActiveItem(child.label)
                                if (child.path) {
                                  navigate(child.path)
                                  onClose?.()
                                }
                                setActiveFlyout(null)
                              }}
                              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-black transition ${
                                isChildActive || child.path === location.pathname
                                  ? 'bg-teal-700 text-white'
                                  : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                              }`}
                            >
                              <ChildIcon className="h-4 w-4 shrink-0" />
                              {child.label}
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
    </div>
  )
}
