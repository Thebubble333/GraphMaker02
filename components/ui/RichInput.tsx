
import React, { useRef, KeyboardEvent } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

interface RichInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (val: string) => void; // Alternative handler for direct string updates
}

export const RichInput: React.FC<RichInputProps> = ({ value, onChange, onValueChange, className, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const applyTag = (tag: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    
    const selected = value.substring(start, end);
    // Simple toggle check could be added here, but for now we just wrap
    const newText = value.substring(0, start) + `\\${tag}{` + selected + `}` + value.substring(end);
    
    // Create synthetic event if onChange is provided
    if (onChange) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeInputValueSetter?.call(input, newText);
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    } else if (onValueChange) {
        onValueChange(newText);
    }

    // Restore focus and selection
    setTimeout(() => {
        input.focus();
        const newCursorPos = start + tag.length + 2 + selected.length + 1; // \tag{...} cursor after
        input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
              case 'b':
                  e.preventDefault();
                  applyTag('textbf');
                  break;
              case 'i':
                  e.preventDefault();
                  applyTag('textit');
                  break;
              case 'u':
                  e.preventDefault();
                  applyTag('underline');
                  break;
          }
      }
      if (props.onKeyDown) props.onKeyDown(e);
  };

  return (
    <div className="relative group">
        <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            className={`w-full pr-24 ${className}`} // Padding for buttons
            {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white shadow-sm border border-gray-200 rounded px-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button 
                type="button"
                onClick={(e) => applyTag('textbf', e)} 
                className="p-1 hover:bg-gray-100 rounded text-gray-600" 
                title="Bold (Ctrl+B)"
            >
                <Bold size={12} />
            </button>
            <button 
                type="button"
                onClick={(e) => applyTag('textit', e)} 
                className="p-1 hover:bg-gray-100 rounded text-gray-600" 
                title="Italic (Ctrl+I)"
            >
                <Italic size={12} />
            </button>
            <button 
                type="button"
                onClick={(e) => applyTag('underline', e)} 
                className="p-1 hover:bg-gray-100 rounded text-gray-600" 
                title="Underline (Ctrl+U)"
            >
                <Underline size={12} />
            </button>
        </div>
    </div>
  );
};
