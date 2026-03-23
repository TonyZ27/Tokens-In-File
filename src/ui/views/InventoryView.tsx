import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '../components/Button';
import { ReplacePopover, AvailableVariable } from '../components/ReplacePopover';
import {
  ArrowLeft, RefreshCw, Search, ChevronDown, ChevronRight,
  Lock, EyeOff, Target, Component, Box, Type, Square, Frame,
  CircleHelp, Unlink,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { Checkbox } from '../components/Checkbox';
import { cn } from '../utils/cn';

export interface TokenNode {
  id: string;
  name: string;
  type: string;
  variableName: string;
  collectionName: string;
  groupName: string;
  frameName: string;
  pageName: string;
  source: 'local' | 'linked' | 'unlinked' | 'missing';
  isLocked: boolean;
  isHidden: boolean;
  variableType?: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' | 'TYPOGRAPHY' | 'MISSING' | 'UNKNOWN';
  /** Property keys bound to variables on this node (e.g. 'fills', 'strokes', 'opacity') */
  boundPropertyKeys?: string[];
  /** For styles, the style id */
  variableId?: string | null;
  /** Actual value of the variable/style */
  value?: any;
  /** Library name identifying the source of the variable/style */
  libraryName?: string;
}

interface InventoryViewProps {
  onBack: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  nodes: TokenNode[];
}

type NodeStatus = 'idle' | 'pending' | 'success' | 'error';

// Flat list types for Virtuoso rendering
type ListItem =
  | { type: 'groupHeader'; name: string; isCollapsed: boolean }
  | { type: 'variableRow'; id: string; name: string; count: number; isExpanded: boolean; variableType: string; value?: any }
  | { type: 'frameHeader'; name: string }
  | { type: 'nodeRow'; node: TokenNode; isChecked: boolean };

export function InventoryView({ onBack, onRefresh, isRefreshing, nodes }: InventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [topIndex, setTopIndex] = useState(0);

  // --- Node status state machine ---
  const [nodeStatus, setNodeStatus] = useState<Map<string, NodeStatus>>(new Map());
  const [nodeErrors, setNodeErrors] = useState<Map<string, string>>(new Map());
  // Ids fading out after success (CSS transition)
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // --- Replace Popover state ---
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isLoadingVars, setIsLoadingVars] = useState(false);
  const [availableVariables, setAvailableVariables] = useState<AvailableVariable[]>([]);

  // --- Listen to plugin messages ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === 'all-variables') {
        setAvailableVariables(msg.payload);
        setIsLoadingVars(false);
      }

      if (msg.type === 'batch-replace-result' || msg.type === 'batch-detach-result') {
        const results: Array<{ id: string; success: boolean; reason?: string }> = msg.payload;

        const newStatus = new Map(nodeStatus);
        const newErrors = new Map(nodeErrors);
        const successIds: string[] = [];

        results.forEach(r => {
          if (r.success) {
            newStatus.set(r.id, 'success');
            successIds.push(r.id);
          } else {
            newStatus.set(r.id, 'error');
            newErrors.set(r.id, r.reason ?? '操作失败');
          }
        });

        setNodeStatus(newStatus);
        setNodeErrors(newErrors);

        // Fade-out success items after 600ms, then remove from list
        if (successIds.length > 0) {
          setTimeout(() => {
            setFadingIds(prev => new Set([...prev, ...successIds]));
            setTimeout(() => {
              setSelectedNodeIds(prev => {
                const next = new Set(prev);
                successIds.forEach(id => next.delete(id));
                return next;
              });
              setNodeStatus(prev => {
                const next = new Map(prev);
                successIds.forEach(id => next.delete(id));
                return next;
              });
              setFadingIds(prev => {
                const next = new Set(prev);
                successIds.forEach(id => next.delete(id));
                return next;
              });
            }, 400);
          }, 600);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [nodeStatus, nodeErrors]);

  // --- Derive collections ---
  type LibraryGroup = {
    libraryName: string;
    collections: string[];
    priority: number;
  };

  const libraryGroups = useMemo(() => {
    const groupsMap = new Map<string, Set<string>>();
    nodes.forEach(n => {
      const lib = n.libraryName || 'Local Library';
      const coll = n.collectionName || 'Default';
      if (!groupsMap.has(lib)) groupsMap.set(lib, new Set());
      groupsMap.get(lib)!.add(coll);
    });

    const groups: LibraryGroup[] = Array.from(groupsMap.entries()).map(([lib, collSet]) => {
      const colls = Array.from(collSet).sort((a, b) => {
        const getPriority = (name: string) => {
          if (name === 'Hardcoded') return 4;
          if (name === 'Missing') return 3;
          if (name.includes('Styles') || name === 'Typography') return 2;
          return 1;
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return a.localeCompare(b);
      });
      
      let priority = 2; // Specific Linked Libraries
      if (lib === 'Local Library') priority = 1;
      if (lib === 'Unlinked Library') priority = 3;
      if (lib === 'Missing') priority = 4;
      if (lib === 'Hardcoded') priority = 5;
      
      return { libraryName: lib, collections: colls, priority };
    });

    return groups.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.libraryName.localeCompare(b.libraryName);
    });
  }, [nodes]);

  const activeKey = useMemo(() => {
    if (selectedKey) return selectedKey;
    if (libraryGroups.length > 0 && libraryGroups[0].collections.length > 0) {
      return `${libraryGroups[0].libraryName}:${libraryGroups[0].collections[0]}`;
    }
    return 'Local Library:Default';
  }, [selectedKey, libraryGroups]);

  const filteredNodes = useMemo(() => {
    const splitIndex = activeKey.indexOf(':');
    const activeLib = activeKey.slice(0, splitIndex);
    const activeColl = activeKey.slice(splitIndex + 1);

    return nodes.filter(n => {
      const nodeLib = n.libraryName || 'Local Library';
      const nodeColl = n.collectionName || 'Default';
      const matchKey = nodeLib === activeLib && nodeColl === activeColl;
      const matchSearch =
        n.variableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchKey && matchSearch;
    });
  }, [nodes, activeKey, searchQuery]);

  // --- Flatten hierarchy for Virtuoso ---
  const { groupCounts, groupHeaders, flattenedItems } = useMemo(() => {
    const counts: number[] = [];
    const headers: ListItem[] = [];
    const items: ListItem[] = [];

    if (filteredNodes.length === 0) return { groupCounts: counts, groupHeaders: headers, flattenedItems: items };

    const groupsMap = new Map<string, TokenNode[]>();
    filteredNodes.forEach(n => {
      const g = n.groupName || 'Global';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(n);
    });

    const sortedGroups = Array.from(groupsMap.keys()).sort((a, b) => {
      if (a === 'Global') return -1;
      if (b === 'Global') return 1;
      return a.localeCompare(b);
    });

    sortedGroups.forEach(groupName => {
      const isCollapsed = collapsedGroups.has(groupName);
      headers.push({ type: 'groupHeader', name: groupName, isCollapsed });

      let currentGroupItemCount = 0;

      if (!isCollapsed) {
        const groupNodes = groupsMap.get(groupName)!;
        const varsMap = new Map<string, TokenNode[]>();
        groupNodes.forEach(n => {
          if (!varsMap.has(n.variableName)) varsMap.set(n.variableName, []);
          varsMap.get(n.variableName)!.push(n);
        });

        const sortedVars = Array.from(varsMap.keys()).sort();
        sortedVars.forEach(varName => {
          const vNodes = varsMap.get(varName)!;
          const isExpanded = expandedVars.has(varName);

            items.push({
              type: 'variableRow',
              id: varName,
              name: varName,
              count: vNodes.length,
              isExpanded,
              variableType: vNodes[0].variableType || 'UNKNOWN',
              value: vNodes[0].value,
            });
          currentGroupItemCount++;

          if (isExpanded) {
            const framesMap = new Map<string, TokenNode[]>();
            vNodes.forEach(n => {
              const f = `${n.pageName || 'Unknown Page'} / ${n.frameName || 'Canvas'}`;
              if (!framesMap.has(f)) framesMap.set(f, []);
              framesMap.get(f)!.push(n);
            });

            const sortedFrames = Array.from(framesMap.keys()).sort();
            sortedFrames.forEach(frameName => {
              items.push({ type: 'frameHeader', name: frameName });
              currentGroupItemCount++;

              const fNodes = framesMap.get(frameName)!;
              fNodes.forEach(n => {
                items.push({
                  type: 'nodeRow',
                  node: n,
                  isChecked: selectedNodeIds.has(n.id),
                });
                currentGroupItemCount++;
              });
            });
          }
        });
      }

      counts.push(currentGroupItemCount);
    });

    return { groupCounts: counts, groupHeaders: headers, flattenedItems: items };
  }, [filteredNodes, expandedVars, collapsedGroups, selectedNodeIds]);

  const activeOverlayVariable = useMemo(() => {
    if (!flattenedItems || flattenedItems.length === 0) return null;
    let activeVar: ListItem | null = null;
    for (let i = topIndex; i >= 0; i--) {
      const item = flattenedItems[i];
      if (item && item.type === 'variableRow') {
        activeVar = item;
        break;
      }
    }
    return activeVar;
  }, [topIndex, flattenedItems]);

  // --- Handlers ---
  const toggleGroupCollapsed = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const toggleVariableExpanded = (varName: string) => {
    setExpandedVars(prev => {
      const next = new Set(prev);
      if (next.has(varName)) next.delete(varName);
      else next.add(varName);
      return next;
    });
  };

  const toggleNodeSelection = (id: string, checked: boolean) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleZoom = (id: string) => {
    parent.postMessage({ pluginMessage: { type: 'zoom-to-node', payload: { id } } }, '*');
  };

  // Batch actions
  const handleReplaceClick = useCallback(() => {
    // Step 1: request variables list from backend
    setIsLoadingVars(true);
    setAvailableVariables([]);
    setIsPopoverOpen(true);
    parent.postMessage({ pluginMessage: { type: 'get-all-variables' } }, '*');
  }, []);

  const handleVariableSelected = useCallback((variable: AvailableVariable) => {
    // Mark selected nodes as pending
    const ids = Array.from(selectedNodeIds);
    const newStatus = new Map(nodeStatus);
    ids.forEach(id => newStatus.set(id, 'pending'));
    setNodeStatus(newStatus);

    // Collect bound property keys per node
    const nodePayloads = ids.map(id => {
      const node = nodes.find(n => n.id === id);
      return { id, boundPropertyKeys: node?.boundPropertyKeys ?? [] };
    });

    parent.postMessage({
      pluginMessage: {
        type: 'batch-replace',
        payload: {
          nodes: nodePayloads,
          targetVariableId: variable.id,
        },
      },
    }, '*');
  }, [selectedNodeIds, nodeStatus, nodes]);

  const handleDetach = useCallback(() => {
    const ids = Array.from(selectedNodeIds);
    const newStatus = new Map(nodeStatus);
    ids.forEach(id => newStatus.set(id, 'pending'));
    setNodeStatus(newStatus);

    const nodePayloads = ids.map(id => {
      const node = nodes.find(n => n.id === id);
      return { id, boundPropertyKeys: node?.boundPropertyKeys ?? [] };
    });

    parent.postMessage({
      pluginMessage: {
        type: 'batch-detach',
        payload: { nodes: nodePayloads },
      },
    }, '*');
  }, [selectedNodeIds, nodeStatus, nodes]);

  const hasSelection = selectedNodeIds.size > 0;

  // --- Figma-like Variable Hexagon Icon ---
  const VariableIcon = ({ className }: { className?: string }) => (
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
  const TokenValueDisplay = ({ vType, value }: { vType: string, value: any }) => {
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
  const VariableTypeIcon = ({ vType }: { vType: string }) => {
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

  return (
    <div className="w-full h-full flex flex-col bg-[var(--figma-color-bg)] text-[var(--figma-color-text)] overflow-hidden">

      {/* Top Header */}
      <div className="flex flex-col p-2 border-b border-[var(--figma-color-border)] gap-2">
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={onBack} className="px-2 border-transparent shadow-none hover:bg-[var(--figma-color-bg-hover)] h-6">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Button>
          <Button variant="secondary" size="sm" onClick={onRefresh} className="px-2 border-transparent shadow-none hover:bg-[var(--figma-color-bg-hover)] h-6" disabled={isRefreshing}>
            {isRefreshing
              ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Refresh
          </Button>
        </div>
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            className="w-full h-7 pl-7 pr-2 text-[11px] bg-transparent border border-[var(--figma-color-border)] rounded focus:outline-none focus:border-[#0d99ff] transition-colors placeholder:text-[var(--figma-color-text-tertiary)]"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[130px] overflow-y-auto border-r border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)] flex flex-col shrink-0 flex-nowrap hide-scrollbar p-1 gap-2">
          {libraryGroups.map(group => (
            <div key={group.libraryName} className="flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[9px] font-bold text-[var(--figma-color-text-tertiary)] uppercase tracking-wider truncate" title={group.libraryName}>
                {group.libraryName}
              </div>
              {group.collections.map(c => {
                const itemKey = `${group.libraryName}:${c}`;
                const isSelected = activeKey === itemKey;
                const isMissing = group.libraryName === 'Missing' || c === 'Missing';
                const isHardcoded = group.libraryName === 'Hardcoded' || c === 'Hardcoded';
                const isUnlinked = group.libraryName === 'Unlinked Library';
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedKey(itemKey)}
                    className={cn(
                      "text-[10px] text-left font-medium px-2 py-1.5 rounded truncate transition-colors flex items-center justify-between group",
                      isSelected
                        ? "bg-[#0d99ff] text-white"
                        : isMissing
                        ? "text-[#f24822] hover:bg-[#f24822]/10"
                        : isHardcoded || isUnlinked
                        ? "text-[var(--figma-color-text-tertiary)] hover:bg-[var(--figma-color-bg-hover)] italic"
                        : "text-[var(--figma-color-text-secondary)] hover:bg-[var(--figma-color-bg-hover)]"
                    )}
                    title={c}
                  >
                    <span className="truncate">{c}</span>
                    {isMissing && <CircleHelp className={cn("w-3 h-3 shrink-0 opacity-80", isSelected ? "text-white" : "text-[#f24822]")} />}
                    {isHardcoded && <Unlink className={cn("w-3 h-3 shrink-0 opacity-80", isSelected ? "text-white" : "text-[var(--figma-color-text-tertiary)]")} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Main Content */}
        <div className="flex-1 relative overflow-hidden bg-[var(--figma-color-bg)]">
          {groupHeaders.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs opacity-50">
              No instances match.
            </div>
          ) : (
            <GroupedVirtuoso
              groupCounts={groupCounts}
              rangeChanged={(range) => setTopIndex(range.startIndex)}
              className="w-full h-full scroll-smooth"
              groupContent={(index) => {
                const item = groupHeaders[index];
                if (item?.type === 'groupHeader') {
                  return (
                    <div
                      className="px-3 h-[28px] bg-[var(--figma-color-bg-secondary)] border-y border-[var(--figma-color-border)] text-[10px] font-bold text-[var(--figma-color-text-secondary)] uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:bg-[var(--figma-color-bg-hover)]"
                      onClick={() => toggleGroupCollapsed(item.name)}
                    >
                      {item.isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />}
                      {item.name}
                    </div>
                  );
                }
                return null;
              }}
              itemContent={(_index) => {
                const item = flattenedItems[_index];

                // Variable Row
                if (item.type === 'variableRow') {
                  return (
                    <div
                      className="flex items-center justify-between px-3 h-[32px] border-b border-[var(--figma-color-border)] hover:bg-[var(--figma-color-bg-hover)] cursor-pointer group bg-[var(--figma-color-bg)]"
                      onClick={() => toggleVariableExpanded(item.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        {item.isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />}
                        
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <TokenValueDisplay vType={item.variableType} value={item.value} />
                          <VariableTypeIcon vType={item.variableType} />
                          <span className="text-xs font-semibold truncate">{item.name}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--figma-color-text-secondary)] bg-[var(--figma-color-bg-secondary)] px-1.5 py-0.5 rounded-full shrink-0 group-hover:bg-[#0d99ff] group-hover:text-white transition-colors">
                        {item.count}
                      </span>
                    </div>
                  );
                }

                // Frame Header
                if (item.type === 'frameHeader') {
                  return (
                    <div className="pl-8 pr-3 py-1.5 bg-[var(--figma-color-bg)] text-[10px] font-medium text-[var(--figma-color-text-tertiary)] flex items-center gap-1 opacity-80 mt-1">
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      {item.name}
                    </div>
                  );
                }

                // Node Row
                if (item.type === 'nodeRow') {
                  const n = item.node;
                  const isChecked = item.isChecked;
                  const status = nodeStatus.get(n.id) ?? 'idle';
                  const errMsg = nodeErrors.get(n.id);
                  const isFading = fadingIds.has(n.id);

                  return (
                    <div
                      className={cn(
                        "group flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-pointer transition-all duration-300 bg-[var(--figma-color-bg)]",
                        status === 'success' && "bg-green-500/10",
                        status === 'error' && "bg-red-500/10",
                        status === 'pending' && "opacity-50 pointer-events-none",
                        isFading && "opacity-0",
                        (n.isLocked || n.isHidden) && status === 'idle' && "opacity-60",
                        "hover:bg-[var(--figma-color-bg-hover)]",
                      )}
                      onClick={() => handleZoom(n.id)}
                      title={errMsg}
                    >
                      <div onClick={e => e.stopPropagation()} className="shrink-0 pt-0.5">
                        <Checkbox
                          label=""
                          checked={isChecked}
                          onChange={e => toggleNodeSelection(n.id, e.target.checked)}
                          disabled={status === 'pending'}
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          {n.type === 'COMPONENT' && <Component className="w-3 h-3 text-purple-500 shrink-0" />}
                          {n.type === 'INSTANCE' && <Box className="w-3 h-3 text-purple-400 shrink-0" />}
                          {n.type === 'TEXT' && <Type className="w-3 h-3 text-blue-400 shrink-0" />}
                          {(n.type === 'RECTANGLE' || n.type === 'ELLIPSE' || n.type === 'POLYGON' || n.type === 'STAR' || n.type === 'VECTOR') && <Square className="w-3 h-3 text-[var(--figma-color-icon-secondary)] shrink-0" />}
                          {(n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'SECTION') && <Frame className="w-3 h-3 text-[var(--figma-color-icon-secondary)] shrink-0" />}
                          <span className={cn(
                            "text-[11px] truncate leading-snug group-hover:text-[#0d99ff] transition-colors",
                            status === 'error' && "text-red-500 group-hover:text-red-400",
                          )}>
                            {n.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          {/* Status indicators */}
                          {status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                          {status === 'error' && (
                            <span title={errMsg}>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </span>
                          )}

                          {/* Idle state icons */}
                          {status === 'idle' && n.isLocked && <Lock className="w-3 h-3 text-red-400" />}
                          {status === 'idle' && n.isHidden && <EyeOff className="w-3 h-3 text-gray-400" />}

                          {/* Hover Target Icon */}
                          {status === 'idle' && (
                            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all text-[#0d99ff] hover:bg-[#0d99ff] hover:text-white">
                              <Target className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              }}
            />
          )}

          {/* Sticky Variable Header Overlay */}
          {activeOverlayVariable && activeOverlayVariable.type === 'variableRow' && activeOverlayVariable.isExpanded && (
            <div className="absolute top-[28px] left-0 right-0 z-[15] pointer-events-auto bg-[var(--figma-color-bg)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div
                className="flex items-center justify-between px-3 h-[32px] border-b border-[var(--figma-color-border)] cursor-pointer group hover:bg-[var(--figma-color-bg-hover)]"
                onClick={() => toggleVariableExpanded(activeOverlayVariable.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <TokenValueDisplay vType={activeOverlayVariable.variableType} value={activeOverlayVariable.value} />
                    <VariableTypeIcon vType={activeOverlayVariable.variableType} />
                    <span className="text-xs font-semibold truncate">{activeOverlayVariable.name}</span>
                  </div>
                </div>
                <span className="text-[10px] text-[var(--figma-color-text-secondary)] bg-[var(--figma-color-bg-secondary)] px-1.5 py-0.5 rounded-full shrink-0 group-hover:bg-[#0d99ff] group-hover:text-white transition-colors">
                  {activeOverlayVariable.count}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB Batch Action Bottom Bar */}
      <div className="relative p-2 border-t border-[var(--figma-color-border)] bg-[var(--figma-color-bg)] flex gap-2 z-[35] shrink-0">
        {/* Replace Popover anchored above this bar */}
        <ReplacePopover
          isOpen={isPopoverOpen}
          isLoading={isLoadingVars}
          variables={availableVariables}
          onSelect={handleVariableSelected}
          onClose={() => setIsPopoverOpen(false)}
        />

        <Button
          variant="primary"
          size="sm"
          fullWidth
          disabled={!hasSelection}
          onClick={handleReplaceClick}
          className={cn(!hasSelection && "opacity-50 cursor-not-allowed")}
        >
          Replace {hasSelection ? `(${selectedNodeIds.size})` : ''}
        </Button>
        <Button
          variant="danger"
          size="sm"
          fullWidth
          disabled={!hasSelection}
          onClick={handleDetach}
          className={cn(!hasSelection && "opacity-50 cursor-not-allowed")}
        >
          Detach
        </Button>
      </div>

    </div>
  );
}
