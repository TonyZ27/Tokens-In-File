import React from 'react';
import { cn } from '../utils/cn';
import { Check } from 'lucide-react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className="relative flex items-center justify-center w-4 h-4">
        <input
          type="checkbox"
          className={cn(
            "peer appearance-none w-4 h-4 border border-[var(--figma-color-border)] rounded-sm",
            "checked:bg-[#0d99ff] checked:border-[#0d99ff]",
            "group-hover:border-[var(--figma-color-border-hover)] transition-colors cursor-pointer",
            className
          )}
          {...props}
        />
        <Check ref={null} className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </div>
      <span className="text-xs text-[var(--figma-color-text)] select-none">
        {label}
      </span>
    </label>
  );
}
