import { useState, useEffect, useRef } from 'react';
import { SetupView } from './views/SetupView';
import { InventoryView } from './views/InventoryView';

export default function App() {
  const [view, setView] = useState<'setup' | 'inventory'>('setup');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [lastConfig, setLastConfig] = useState<any>(null);

  const viewRef = useRef(view);
  const lastConfigRef = useRef(lastConfig);

  useEffect(() => {
    viewRef.current = view;
    lastConfigRef.current = lastConfig;
  }, [view, lastConfig]);

  const handleScan = (config: any) => {
    setLastConfig(config);
    setIsScanning(true);
    parent.postMessage({ pluginMessage: { type: 'start-scan', payload: config } }, '*');
  };

  useEffect(() => {
    // Listen for messages from the Figma backend
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'scan-complete') {
        setIsScanning(false);
        setScanResults(msg.payload || []);
        setView('inventory');
      } else if (msg.type === 'scan-cancelled') {
        setIsScanning(false);
      } else if (msg.type === 'selectionchange') {
        if (viewRef.current === 'inventory' && lastConfigRef.current?.scope === 'selection') {
          handleScan(lastConfigRef.current);
        }
      } else if (msg.type === 'currentpagechange') {
        if (viewRef.current === 'inventory' && lastConfigRef.current?.scope === 'page') {
          handleScan(lastConfigRef.current);
        }
      } else if (msg.type === 'batch-replace-result' || msg.type === 'batch-detach-result') {
        const results: Array<{ id: string; success: boolean; newData?: any }> = msg.payload;
        setScanResults(prev => {
          const next = [...prev];
          results.forEach(res => {
            if (res.success && res.newData) {
              const idx = next.findIndex(n => n.id === res.id);
              if (idx !== -1) {
                next[idx] = { ...next[idx], ...res.newData };
              }
            }
          });
          return next;
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCancel = () => {
    setIsScanning(false);
    parent.postMessage({ pluginMessage: { type: 'cancel-scan' } }, '*');
  };

  return (
    <div className="w-full h-screen relative bg-[var(--figma-color-bg)] text-[var(--figma-color-text)] overflow-hidden font-sans">
      {view === 'setup' && (
        <SetupView 
          initialConfig={lastConfig}
          onScan={handleScan} 
          isScanning={isScanning} 
          onCancel={handleCancel} 
        />
      )}
      
      {view === 'inventory' && (
        <InventoryView 
          nodes={scanResults}
          isRefreshing={isScanning}
          onBack={() => setView('setup')}
          onRefresh={() => {
            if (lastConfig) {
              handleScan(lastConfig);
            }
          }}
        />
      )}
    </div>
  );
}
