import React, { useState, useEffect } from 'react';

interface SmartNumberInputProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number | string;
    className?: string;
}

export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
    value, onChange, min = -Infinity, max = Infinity, step = "1", className
}) => {
    const [localValue, setLocalValue] = useState(String(value));

    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleBlur = () => {
        let parsed = parseFloat(localValue);
        if (isNaN(parsed)) {
            setLocalValue(String(value));
            return;
        }
        parsed = Math.max(min, Math.min(max, parsed));
        setLocalValue(String(parsed));
        if (parsed !== value) {
            onChange(parsed);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            type="number"
            className={className}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            step={step}
        />
    );
};
