import React from 'react';
import { cn } from '../utils/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ className, label, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-xs font-semibold text-[var(--figma-color-text)]">{label}</label>}
      <select
        className={cn(
          "w-full h-8 px-2 text-sm bg-[var(--figma-color-bg)] text-[var(--figma-color-text)]",
          "border border-[var(--figma-color-border)] rounded hover:border-[var(--figma-color-border-hover)]",
          "focus:border-[#0d99ff] focus:outline-none transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
}
