import React from 'react';
import { cn } from '../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  fullWidth, 
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        {
          'bg-[#0d99ff] text-white hover:bg-[#0b8aeb]': variant === 'primary',
          'bg-transparent text-[var(--figma-color-text)] border border-[var(--figma-color-border)] hover:bg-[var(--figma-color-bg-hover)]': variant === 'secondary',
          'bg-[#f24822] text-white hover:bg-[#da411f]': variant === 'danger',
          'h-7 px-3 text-xs': size === 'sm',
          'h-8 px-4 text-sm': size === 'md',
          'h-10 px-6 text-sm': size === 'lg',
          'w-full': fullWidth,
        },
        className
      )}
      {...props}
    />
  );
}
