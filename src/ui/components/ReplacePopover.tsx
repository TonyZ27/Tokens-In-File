import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

export interface AvailableVariable {
  id: string;
  name: string;
  collectionName: string;
  resolvedType: string;
}

interface ReplacePopoverProps {
  isOpen: boolean;
  isLoading: boolean;
  variables: AvailableVariable[];
  onSelect: (variable: AvailableVariable) => void;
  onClose: () => void;
}

export function ReplacePopover({ isOpen, isLoading, variables, onSelect, onClose }: ReplacePopoverProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return variables.filter(
      v => v.name.toLowerCase().includes(q) || v.collectionName.toLowerCase().includes(q)
    );
  }, [variables, query]);

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen dimmer */}
      <div className="fixed inset-0 z-[30] bg-black/20" aria-hidden="true" />

      {/* Popover Panel – positioned above the bottom bar */}
      <div
        ref={containerRef}
        className="absolute bottom-full left-0 right-0 z-[40] mb-1 mx-2 rounded-lg border border-[var(--figma-color-border)] bg-[var(--figma-color-bg)] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] overflow-hidden"
        style={{ maxHeight: 240 }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)]">
          {isLoading
            ? <Loader2 className="w-3.5 h-3.5 opacity-40 animate-spin shrink-0" />
            : <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search variables…"
            className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-[var(--figma-color-text-tertiary)]"
          />
        </div>

        {/* Variable List */}
        <div className="overflow-y-auto" style={{ maxHeight: 196 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-[11px] opacity-40">
              Loading variables…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-[11px] opacity-40">
              No variables found
            </div>
          ) : (
            filtered.map(v => (
              <button
                key={v.id}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-[var(--figma-color-bg-hover)] transition-colors"
                )}
                onClick={() => {
                  onSelect(v);
                  onClose();
                }}
              >
                <span className="text-[11px] font-medium truncate">{v.name}</span>
                <span className="text-[10px] text-[var(--figma-color-text-tertiary)] shrink-0 truncate max-w-[90px]">
                  {v.collectionName}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
