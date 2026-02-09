
import React from 'react';
import { Page } from '../types';
import { NAV_GROUPS } from '../config/navigation';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 flex items-center">
          <span className="mr-2 text-2xl">📐</span> GraphMaker
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group, idx) => (
            <div key={group.title || idx}>
                {group.title && (
                    <div className={`px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider ${idx > 0 ? 'mt-6 mb-2' : 'mb-2'}`}>
                        {group.title}
                    </div>
                )}
                {group.items.map(item => (
                    <button
                        key={item.page}
                        onClick={() => onNavigate(item.page)}
                        className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors ${
                            currentPage === item.page
                            ? 'bg-blue-100 text-blue-700 border-r-4 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <span className="mr-3">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-200 text-xs text-center text-gray-400">
        GraphMaker v3.0 (React)
      </div>
    </div>
  );
};

export default Sidebar;
