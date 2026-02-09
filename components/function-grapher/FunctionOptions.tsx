
import React from 'react';
import { Settings2, Calculator, Waves, TrendingUp, Grid, MoveUpRight } from 'lucide-react';

interface FunctionOptionsProps {
  showExactValues: boolean;
  onToggleExactValues: (val: boolean) => void;
  onLoadPreset: (presetKey: string) => void;
}

export const FunctionOptions: React.FC<FunctionOptionsProps> = ({
  showExactValues,
  onToggleExactValues,
  onLoadPreset
}) => {
  const presets = [
    {
      key: 'standard',
      label: 'Standard',
      icon: <Grid size={20} className="text-gray-500" />,
      desc: '10x10 Grid, Empty'
    },
    {
      key: 'trig',
      label: 'Trigonometry',
      icon: <Waves size={20} className="text-blue-500" />,
      desc: 'Sin/Cos, π-axis steps'
    },
    {
      key: 'polynomials',
      label: 'Polynomials',
      icon: <TrendingUp size={20} className="text-purple-500" />,
      desc: 'Quadratic & Cubic'
    },
    {
      key: 'quadrant1',
      label: 'Quadrant 1',
      icon: <MoveUpRight size={20} className="text-green-500" />,
      desc: 'Positive x, y only'
    },
    {
      key: 'kinematics',
      label: 'Kinematics',
      icon: <Calculator size={20} className="text-orange-500" />,
      desc: 'Velocity vs Time'
    }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={14} /> 
            Page Options
        </h2>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
        
        {/* Calculation Settings */}
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-800">Calculation & Display</h3>
            <div className="bg-white border border-gray-200 rounded-md p-3">
                <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showExactValues ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'}`}>
                        {showExactValues && <span className="text-[10px]">✓</span>}
                    </div>
                    <input 
                        type="checkbox" 
                        checked={showExactValues}
                        onChange={(e) => onToggleExactValues(e.target.checked)}
                        className="hidden"
                    />
                    <div>
                        <span className="block font-medium">Exact Values</span>
                        <span className="block text-xs text-gray-500">Show π fractions and √ surds</span>
                    </div>
                </label>
            </div>
        </div>

        {/* Presets Grid */}
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-800">Quick Start Presets</h3>
            <div className="grid grid-cols-1 gap-2">
                {presets.map(p => (
                    <button
                        key={p.key}
                        onClick={() => onLoadPreset(p.key)}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left group"
                    >
                        <div className="p-2 bg-gray-50 rounded group-hover:bg-blue-50 transition-colors">
                            {p.icon}
                        </div>
                        <div>
                            <span className="block text-sm font-medium text-gray-700 group-hover:text-blue-700">{p.label}</span>
                            <span className="block text-[10px] text-gray-400">{p.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-gray-400 italic text-center pt-2">
                Loading a preset will replace current functions and window settings.
            </p>
        </div>

      </div>
    </div>
  );
};
