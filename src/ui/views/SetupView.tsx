import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface SetupViewProps {
  initialConfig?: any;
  onScan: (config: any) => void;
  isScanning: boolean;
  onCancel: () => void;
}

const ToggleChip = ({ label, checked, onChange, disabled }: { label: React.ReactNode, checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "px-3 py-1.5 rounded text-[11px] font-medium transition-all border select-none flex items-center justify-center gap-1.5 w-full sm:w-auto",
      checked
        ? "bg-[#e5f4ff] text-[#0d99ff] border-[#0d99ff] shadow-sm dark:bg-[#0d99ff]/20"
        : "bg-transparent text-[var(--figma-color-text)] border-[var(--figma-color-border)] hover:bg-[var(--figma-color-bg-hover)] hover:border-[var(--figma-color-border-strong)]",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
    )}
  >
    {label}
  </button>
);

export function SetupView({ initialConfig, onScan, isScanning, onCancel }: SetupViewProps) {
  const [scope, setScope] = useState(initialConfig?.scope || 'page');
  const [types, setTypes] = useState(initialConfig?.types || { variables: true, styles: true });
  const [sources, setSources] = useState(initialConfig?.sources || { local: true, linked: true, unlinked: true, missing: true });
  const [layerTypes, setLayerTypes] = useState(initialConfig?.layerTypes || { component: true, instance: true, text: true, shape: true, frame: true });

  const handleStartScan = () => {
    onScan({ scope, types, sources, layerTypes });
  };


  const allSourcesChecked = Object.values(sources).every(Boolean);
  const handleToggleAllSources = () => {
    const nextState = !allSourcesChecked;
    setSources(Object.keys(sources).reduce((acc, key) => ({ ...acc, [key]: nextState }), {}));
  };

  const allLayerTypesChecked = Object.values(layerTypes).every(Boolean);
  const handleToggleAllLayerTypes = () => {
    const nextState = !allLayerTypesChecked;
    setLayerTypes(Object.keys(layerTypes).reduce((acc, key) => ({ ...acc, [key]: nextState }), {}));
  };

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[var(--figma-color-bg)]">
      <div className="flex-1 overflow-y-auto space-y-6 pb-20 hide-scrollbar">
        <section>
          <h2 className="text-[11px] font-bold tracking-wider text-[var(--figma-color-text-tertiary)] uppercase mb-3 text-opacity-70">
            Scope
          </h2>
          <Select
            value={scope}
            onChange={e => setScope(e.target.value)}
            disabled={isScanning}
          >
            <option value="file">Entire File</option>
            <option value="page">Current Page</option>
            <option value="selection">Current Selection</option>
          </Select>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold tracking-wider text-[var(--figma-color-text-tertiary)] uppercase text-opacity-70">
              Type
            </h2>
          </div>
          <Select
            value={types.variables && types.styles ? 'all' : types.variables ? 'variables' : 'styles'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'all') setTypes({ ...types, variables: true, styles: true });
              else if (val === 'variables') setTypes({ ...types, variables: true, styles: false });
              else setTypes({ ...types, variables: false, styles: true });
            }}
            disabled={isScanning}
          >
            <option value="all">All</option>
            <option value="variables">Variables</option>
            <option value="styles">Style</option>
          </Select>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold tracking-wider text-[var(--figma-color-text-tertiary)] uppercase text-opacity-70">
              Source
            </h2>
            <button onClick={handleToggleAllSources} disabled={isScanning} className="text-[10px] text-[#0d99ff] hover:underline disabled:opacity-50">
              {allSourcesChecked ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleChip label="Local" checked={sources.local} onChange={c => setSources({ ...sources, local: c })} disabled={isScanning} />
            <ToggleChip label="Linked" checked={sources.linked} onChange={c => setSources({ ...sources, linked: c })} disabled={isScanning} />
            <ToggleChip label="Hardcode" checked={sources.unlinked} onChange={c => setSources({ ...sources, unlinked: c })} disabled={isScanning} />
            <ToggleChip label="Missing" checked={sources.missing} onChange={c => setSources({ ...sources, missing: c })} disabled={isScanning} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold tracking-wider text-[var(--figma-color-text-tertiary)] uppercase text-opacity-70">
              Layer Types Focus
            </h2>
            <button onClick={handleToggleAllLayerTypes} disabled={isScanning} className="text-[10px] text-[#0d99ff] hover:underline disabled:opacity-50">
              {allLayerTypesChecked ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ToggleChip label="Components" checked={layerTypes.component} onChange={c => setLayerTypes({ ...layerTypes, component: c })} disabled={isScanning} />
            <ToggleChip label="Instances" checked={layerTypes.instance} onChange={c => setLayerTypes({ ...layerTypes, instance: c })} disabled={isScanning} />
            <ToggleChip label="Text Nodes" checked={layerTypes.text} onChange={c => setLayerTypes({ ...layerTypes, text: c })} disabled={isScanning} />
            <ToggleChip label="Shapes" checked={layerTypes.shape} onChange={c => setLayerTypes({ ...layerTypes, shape: c })} disabled={isScanning} />
            <ToggleChip label="Frames" checked={layerTypes.frame} onChange={c => setLayerTypes({ ...layerTypes, frame: c })} disabled={isScanning} />
          </div>
        </section>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--figma-color-bg)] border-t border-[var(--figma-color-border)] z-10 flex flex-col gap-2">
        {isScanning ? (
          <>
            <Button fullWidth disabled className="opacity-80">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning Nodes...
            </Button>
            <Button fullWidth variant="secondary" onClick={onCancel}>
              Cancel Scan
            </Button>
          </>
        ) : (
          <Button fullWidth onClick={handleStartScan}>
            Scan
          </Button>
        )}
      </div>

      {isScanning && (
        <div className="absolute inset-0 bg-transparent z-[5]" />
      )}
    </div>
  );
}
