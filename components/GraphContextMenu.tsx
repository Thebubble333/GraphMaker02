import React, { useEffect } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
  dividerBefore?: boolean;
  dividerAbove?: boolean;
}

export interface GraphContextMenuProps {
  x: number;
  y: number;
  title?: string;
  subtitle?: string;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  x,
  y,
  title = 'Quick Actions',
  subtitle,
  items,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = () => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const menuWidth = 240;
  const estimatedHeight = 48 + items.length * 36;
  const clampedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuWidth - 12) : x;
  const clampedY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - estimatedHeight - 12) : y;

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 w-60 text-xs select-none"
      style={{
        left: Math.max(8, clampedX),
        top: Math.max(8, clampedY)
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
        <div className="font-bold text-gray-800 uppercase tracking-wider text-[10px] truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {(item.dividerBefore || item.dividerAbove) && <div className="my-1 border-t border-gray-100" />}
          <button
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors ${
              item.danger
                ? 'text-red-600 hover:bg-red-50'
                : item.accent
                ? 'text-blue-600 hover:bg-blue-50 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
