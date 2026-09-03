import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toggleSidebar, setMobileMenuOpen } from '../../store/slices/uiSlice.js';
import { NAVIGATION_SECTIONS } from '../../navigationConfig.js';
import { usePermissions } from '../../utils/usePermissions.js';
import { cn } from '../../utils/cn.js';

export const Sidebar = () => {
  const dispatch = useDispatch();
  const collapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const mobileOpen = useSelector((state) => state.ui.mobileMenuOpen);
  const { hasPermission, isReadOnly, role } = usePermissions();

  // Filter sections and items based on permissions
  const visibleSections = NAVIGATION_SECTIONS.map((section) => {
    const allowedItems = section.items.filter((item) => hasPermission(item.permission));
    const title = isReadOnly && section.readOnlyTitle ? section.readOnlyTitle : section.title;
    return {
      ...section,
      title,
      items: allowedItems,
    };
  }).filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden animate-fadeIn"
          onClick={() => dispatch(setMobileMenuOpen(false))}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out border-r border-slate-800 shadow-xl lg:static lg:shadow-none',
          // Mobile state
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          // Desktop collapse state
          collapsed ? 'lg:w-20' : 'lg:w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm font-bold">
              N
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="truncate">
                <span className="font-extrabold text-white text-sm tracking-tight">
                  Nyaya<span className="text-blue-400">Data</span>
                </span>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">INTELLIGENCE</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => dispatch(setMobileMenuOpen(false))}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List with Grouped Sections */}
        <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.id} className="space-y-1">
              {section.title && (!collapsed || mobileOpen) && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => dispatch(setMobileMenuOpen(false))}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group',
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      )
                    }
                    title={collapsed ? item.name : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-150',
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                          )}
                        />
                        {(!collapsed || mobileOpen) && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Desktop Collapse / Expand Toggle Button */}
        <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-800/80">
          {!collapsed && (
            <div className="text-[11px] text-slate-400 font-medium px-2 truncate">
              Role: <span className="font-mono text-slate-300 font-bold">{role}</span>
            </div>
          )}
          <button
            onClick={() => dispatch(toggleSidebar())}
            className={cn(
              'p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors',
              collapsed && 'mx-auto'
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
