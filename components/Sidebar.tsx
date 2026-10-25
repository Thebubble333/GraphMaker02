
import React, { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Page } from '../types';
import { NAV_GROUPS } from '../config/navigation';
import { useUISettings } from '../hooks/useUISettings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { settings } = useUISettings();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{ width: collapsed ? 52 : settings.NAV_SIDEBAR_WIDTH }}
      className="bg-white border-r border-gray-200 flex flex-col h-full shadow-xs shrink-0 transition-[width] duration-150"
    >
      <div className={`border-b border-gray-200 flex items-center ${collapsed ? 'justify-center py-2.5 px-1' : 'justify-between px-3.5 py-2.5'}`}>
        {!collapsed && (
          <h1 className="text-base font-bold text-gray-800 flex items-center truncate">
            <span className="mr-1.5 text-lg">📐</span> GraphMaker
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          title={collapsed ? 'Expand Navigation Sidebar' : 'Collapse Navigation Sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group, idx) => (
            <div key={group.title || idx}>
                {group.title && !collapsed && (
                    <div
                      style={{ fontSize: Math.max(9, settings.SECTION_HEADER_FONT_SIZE - 1) }}
                      className={`px-3 font-semibold text-gray-400 uppercase tracking-wider ${idx > 0 ? 'mt-3.5 mb-1' : 'mb-1'}`}
                    >
                        {group.title}
                    </div>
                )}
                {group.title && collapsed && idx > 0 && (
                    <div className="my-1.5 mx-2 border-t border-gray-100" />
                )}
                {group.items.map(item => (
                    <button
                        key={item.page}
                        onClick={() => onNavigate(item.page)}
                        title={collapsed ? item.label : undefined}
                        style={{ fontSize: settings.MENU_FONT_SIZE }}
                        className={`flex items-center w-full ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-1.5'} font-medium transition-colors ${
                            currentPage === item.page
                            ? 'bg-blue-50 text-blue-700 border-r-3 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <span className={`${collapsed ? '' : 'mr-2.5'} shrink-0`}>{item.icon}</span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                ))}
            </div>
        ))}
      </div>
      
      {!collapsed && (
        <div className="px-3 py-2 border-t border-gray-200 text-[10px] text-center text-gray-400">
          GraphMaker v3.0
        </div>
      )}
    </div>
  );
};

export default Sidebar;

