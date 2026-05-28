import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardShell({ currentUser, onOpenProfile, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className="min-h-screen bg-[#eef7f5] text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[296px] border-r border-emerald-100 bg-white shadow-xl shadow-emerald-900/5 transition-all duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 ${
            sidebarCollapsed ? 'lg:w-[84px]' : 'lg:w-[296px]'
          } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar
            currentUser={currentUser}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
            onClose={() => setSidebarOpen(false)}
            onLogout={onLogout}
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

        <section className="min-w-0 flex-1">
          <Topbar
            currentUser={currentUser}
            onOpenProfile={onOpenProfile}
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            sidebarCollapsed={sidebarCollapsed}
            onLogout={onLogout}
          />
          {children}
        </section>
      </div>
    </main>
  );
}
