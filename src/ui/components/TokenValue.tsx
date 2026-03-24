import { CircleHelp } from 'lucide-react';
import { cn } from '../utils/cn';

// --- Figma-like Variable Hexagon Icon ---
export const VariableIcon = ({ className }: { className?: string }) => (
  <svg 
    width="10" 
    height="10" 
    viewBox="0 0 12 12" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={cn("shrink-0 opacity-40", className)}
  >
    <path 
      d="M6 1L10.33 3.5V8.5L6 11L1.67 8.5V3.5L6 1Z" 
      stroke="currentColor" 
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

// --- Token Value Display helper ---
export const TokenValueDisplay = ({ vType, value }: { vType: string, value: any }) => {
  if (value === undefined || value === null) return null;

  if (vType === 'COLOR') {
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    const a = value.a !== undefined ? value.a : 1;
    
    return (
      <div className="flex items-center shrink-0">
        <div 
          className="w-3.5 h-3.5 rounded-full border border-[var(--figma-color-border)] shrink-0 shadow-sm" 
          style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})` }}
        />
      </div>
    );
  }

  if (vType === 'FLOAT' || vType === 'STRING' || vType === 'BOOLEAN') {
    let displayValue = value;
    if (vType === 'FLOAT') displayValue = Number(value).toFixed(0);
    if (vType === 'BOOLEAN') displayValue = value ? 'yes' : 'no';

    return (
      <div className="px-1.5 py-0.5 rounded bg-[var(--figma-color-bg-secondary)] border border-[var(--figma-color-border)] shrink-0 max-w-[80px] flex items-center justify-center">
        <span className={cn(
          "text-[9px] font-medium text-[var(--figma-color-text-secondary)] truncate",
          (vType === 'FLOAT' || vType === 'BOOLEAN') && "uppercase font-bold"
        )}>
          {displayValue}
        </span>
      </div>
    );
  }

  return null;
};

// --- Variable Type Icon helper ---
export const VariableTypeIcon = ({ vType }: { vType: string }) => {
  if (vType === 'TYPOGRAPHY') {
    return (
      <div className="w-3 h-3 flex items-center justify-center text-[var(--figma-color-text-secondary)] shrink-0 font-bold text-[10px] leading-none">
        Aa
      </div>
    );
  }
  if (vType === 'MISSING') return <CircleHelp className="w-3 h-3 text-red-500 shrink-0" />;
  
  // Unified Variable Icon for all other types
  return <VariableIcon className="text-[var(--figma-color-icon-secondary)]" />;
};
