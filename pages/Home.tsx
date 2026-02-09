
import React from 'react';
import { Page } from '../types';
import { NAV_GROUPS } from '../config/navigation';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  // Flatten items for display, excluding Home itself
  const displayGroups = NAV_GROUPS.map(g => ({
      ...g,
      items: g.items.filter(i => i.page !== Page.Home)
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GraphMaker Suite</h1>
        <p className="text-gray-600">Select a tool to create high-quality, publication-ready mathematical graphs.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayGroups.map((group, idx) => (
            <React.Fragment key={idx}>
                <div className="col-span-full mb-2 mt-4 first:mt-0">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{group.title}</h2>
                </div>
                {group.items.map(item => (
                    <div 
                      key={item.page}
                      onClick={() => onNavigate(item.page)}
                      className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${item.colorClass}`}>
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">{item.label}</h3>
                      <p className="text-gray-500 text-sm">{item.description}</p>
                    </div>
                ))}
            </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
