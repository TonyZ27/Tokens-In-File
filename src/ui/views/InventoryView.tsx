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
import { TokenValueDisplay, VariableTypeIcon } from '../components/TokenValue';

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
  | { type: 'variableRow'; id: string; name: string; count: number; isExpanded: boolean; variableType: string; value?: any; isChecked: boolean; isIndeterminate: boolean }
  | { type: 'frameHeader'; name: string }
  | { type: 'nodeRow'; node: TokenNode; isChecked: boolean };

export function InventoryView({ onBack, onRefresh, isRefreshing, nodes }: InventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [topIndex, setTopIndex] = useState(0);

  type TypeFilter = 'All' | 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  const [variableTypeFilter, setVariableTypeFilter] = useState<TypeFilter>('All');

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
        const successKeys: string[] = [];

        results.forEach(r => {
          Array.from(newStatus.keys()).forEach(key => {
            if (key.startsWith(r.id + '::')) {
              if (r.success) {
                newStatus.set(key, 'success');
                successKeys.push(key);
              } else {
                newStatus.set(key, 'error');
                newErrors.set(key, r.reason ?? '操作失败');
              }
            }
          });
        });

        setNodeStatus(newStatus);
        setNodeErrors(newErrors);

        // Fade-out success items after 600ms, then remove from list
        if (successKeys.length > 0) {
          setTimeout(() => {
            setFadingIds(prev => new Set([...prev, ...successKeys]));
            setTimeout(() => {
              setSelectedNodeIds(prev => {
                const next = new Set(prev);
                successKeys.forEach(k => next.delete(k));
                return next;
              });
              setNodeStatus(prev => {
                const next = new Map(prev);
                successKeys.forEach(k => next.delete(k));
                return next;
              });
              setFadingIds(prev => {
                const next = new Set(prev);
                successKeys.forEach(k => next.delete(k));
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

  // --- Derive visibility data for Collections ---
  const collectionsVisibility = useMemo(() => {
    const visibilityMap = new Map<string, Set<string>>();
    nodes.forEach(n => {
      const lib = n.libraryName || 'Local Library';
      const coll = n.collectionName || 'Default';
      const itemKey = `${lib}:${coll}`;
      if (!visibilityMap.has(itemKey)) visibilityMap.set(itemKey, new Set());
      if (n.variableType) visibilityMap.get(itemKey)!.add(n.variableType);
    });
    return visibilityMap;
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
      const matchType = variableTypeFilter === 'All' || n.variableType === variableTypeFilter;
      return matchKey && matchSearch && matchType;
    });
  }, [nodes, activeKey, searchQuery, variableTypeFilter]);

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
          const uniqueVarId = `${groupName}:${varName}`;
          const isVarExpanded = expandedVars.has(uniqueVarId);

          // Calculate selection state for the variable group
          const selectedInGroup = vNodes.filter(n => selectedNodeIds.has(`${n.id}::${varName}::${groupName}`)).length;
          const isChecked = selectedInGroup === vNodes.length && vNodes.length > 0;
          const isIndeterminate = selectedInGroup > 0 && selectedInGroup < vNodes.length;

            items.push({
              type: 'variableRow',
              id: uniqueVarId,
              name: varName,
              count: vNodes.length,
              isExpanded: isVarExpanded,
              variableType: vNodes[0].variableType || 'UNKNOWN',
              value: vNodes[0].value,
              isChecked,
              isIndeterminate,
            });
          currentGroupItemCount++;

          if (isVarExpanded) {
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
                  isChecked: selectedNodeIds.has(`${n.id}::${varName}::${groupName}`),
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

  const toggleVariableSelection = (uniqueId: string, checked: boolean) => {
    const colonIndex = uniqueId.indexOf(':');
    const groupName = uniqueId.slice(0, colonIndex);
    const varName = uniqueId.slice(colonIndex + 1);
    
    const varNodes = filteredNodes.filter(n => n.groupName === groupName && n.variableName === varName);
    const varNodeSelectionKeys = varNodes.map(n => `${n.id}::${varName}::${groupName}`);
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (checked) {
        varNodeSelectionKeys.forEach(k => next.add(k));
      } else {
        varNodeSelectionKeys.forEach(k => next.delete(k));
      }
      return next;
    });
  };

  const toggleNodeSelection = (compositeKey: string, checked: boolean) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(compositeKey);
      else next.delete(compositeKey);
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
    const keys = Array.from(selectedNodeIds);
    const newStatus = new Map(nodeStatus);
    keys.forEach(k => newStatus.set(k, 'pending'));
    setNodeStatus(newStatus);

    // Deduplicate node payload
    const uniqueNodeIds = Array.from(new Set(keys.map(k => k.split('::')[0])));
    const nodePayloads = uniqueNodeIds.map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return { id: nodeId, boundPropertyKeys: node?.boundPropertyKeys ?? [] };
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
    const keys = Array.from(selectedNodeIds);
    const newStatus = new Map(nodeStatus);
    keys.forEach(k => newStatus.set(k, 'pending'));
    setNodeStatus(newStatus);

    const uniqueNodeIds = Array.from(new Set(keys.map(k => k.split('::')[0])));
    const nodePayloads = uniqueNodeIds.map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return { id: nodeId, boundPropertyKeys: node?.boundPropertyKeys ?? [] };
    });

    parent.postMessage({
      pluginMessage: {
        type: 'batch-detach',
        payload: { nodes: nodePayloads },
      },
    }, '*');
  }, [selectedNodeIds, nodeStatus, nodes]);

  const hasSelection = selectedNodeIds.size > 0;


  return (
    <div className="w-full h-full flex flex-col bg-[var(--figma-color-bg)] text-[var(--figma-color-text)] overflow-hidden">

      {/* Top Header */}
      {/* Top Header */}
      <div className="flex flex-col bg-[var(--figma-color-bg)] text-[var(--figma-color-text)]">
        {/* Row 1: Nav Bar */}
        <div className="flex items-center justify-between p-2">
          <Button variant="secondary" size="sm" onClick={onBack} className="px-2 border-transparent shadow-none hover:bg-[var(--figma-color-bg-hover)] h-6">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Button>
        </div>
        
        {/* Row 2: Type Filter with Top and Bottom Borders */}
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar px-2 py-2 border-y border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)]/30">
          {(['All', 'COLOR', 'FLOAT', 'STRING', 'BOOLEAN'] as TypeFilter[]).map(type => (
            <button
              key={type}
              onClick={() => setVariableTypeFilter(type)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-colors border",
                variableTypeFilter === type
                  ? "bg-[#0d99ff]/10 text-[#0d99ff] border-[#0d99ff]"
                  : "bg-transparent text-[var(--figma-color-text-secondary)] border-transparent hover:bg-[var(--figma-color-bg-hover)]"
              )}
            >
              {type === 'FLOAT' ? 'Number' : type === 'COLOR' ? 'Color' : type === 'STRING' ? 'String' : type === 'BOOLEAN' ? 'Boolean' : 'All'}
            </button>
          ))}
        </div>

        {/* Row 3: Search & Actions Toolbar */}
        <div className="flex items-center gap-1.5 p-2 border-b border-[var(--figma-color-border)] relative">
          {/* Replace Popover anchored here */}
          <ReplacePopover
            isOpen={isPopoverOpen}
            isLoading={isLoadingVars}
            variables={availableVariables}
            onSelect={handleVariableSelected}
            onClose={() => setIsPopoverOpen(false)}
            position="bottom"
          />

          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              className="w-full h-7 pl-7 pr-2 text-[11px] bg-transparent border border-[var(--figma-color-border)] rounded focus:outline-none focus:border-[#0d99ff] transition-colors placeholder:text-[var(--figma-color-text-tertiary)]"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleReplaceClick} 
              className={cn(
                "px-2 border-[var(--figma-color-border)] shadow-none h-7 font-medium",
                !hasSelection && "opacity-50 grayscale-[0.5]"
              )}
              disabled={!hasSelection}
            >
              <span className="text-[11px]">Replace</span>
            </Button>

            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleDetach} 
              className={cn(
                "px-2 border-[var(--figma-color-border)] shadow-none h-7 font-medium",
                !hasSelection && "opacity-50 grayscale-[0.5]"
              )}
              disabled={!hasSelection}
            >
              <span className="text-[11px]">Detach</span>
            </Button>

            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onRefresh} 
              className="px-2 border-[var(--figma-color-border)] shadow-none hover:bg-[var(--figma-color-bg-hover)] h-7 shrink-0"
              disabled={isRefreshing}
              title="Refresh"
            >
              {isRefreshing
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[130px] overflow-y-auto border-r border-[var(--figma-color-border)] bg-[var(--figma-color-bg-secondary)] flex flex-col shrink-0 flex-nowrap hide-scrollbar p-1">
          {libraryGroups.map(group => {
            // Check visibility of each collection in this group
            const collectionsWithVisibility = group.collections.map(c => {
              const itemKey = `${group.libraryName}:${c}`;
              const availableTypes = collectionsVisibility.get(itemKey) || new Set();
              const isVisible = variableTypeFilter === 'All' || availableTypes.has(variableTypeFilter);
              return { name: c, isVisible, itemKey };
            });

            // If ALL collections in this group are hidden, hide the group header too
            const isGroupVisible = collectionsWithVisibility.some(c => c.isVisible);

            return (
              <div 
                key={group.libraryName} 
                className={cn(
                  "flex flex-col transition-all duration-300 ease-in-out origin-top",
                  isGroupVisible ? "opacity-100 max-h-[1000px] mb-2" : "opacity-0 max-h-0 overflow-hidden pointer-events-none mb-0"
                )}
              >
                <div className="px-2 py-1 text-[9px] font-bold text-[var(--figma-color-text-tertiary)] uppercase tracking-wider truncate" title={group.libraryName}>
                  {group.libraryName}
                </div>
                <div className="flex flex-col">
                  {collectionsWithVisibility.map(coll => {
                    const isVisible = coll.isVisible;
                    const c = coll.name;
                    const itemKey = coll.itemKey;
                    const isSelected = activeKey === itemKey;
                    const isMissing = group.libraryName === 'Missing' || c === 'Missing';
                    const isHardcoded = group.libraryName === 'Hardcoded' || c === 'Hardcoded';
                    const isUnlinked = group.libraryName === 'Unlinked Library';

                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedKey(itemKey)}
                        className={cn(
                          "text-[10px] text-left font-medium px-2 rounded truncate transition-all duration-200 flex items-center justify-between group",
                          isVisible 
                            ? "opacity-100 max-h-12 py-1.5 mb-0.5" 
                            : "opacity-0 max-h-0 py-0 mb-0 overflow-hidden pointer-events-none",
                          isSelected
                            ? "bg-[#0d99ff] text-white shadow-sm hover:bg-[#0084e5]"
                            : isMissing
                            ? "text-[#f24822] hover:bg-[#f24822]/10 hover:text-[#f24822]"
                            : isHardcoded || isUnlinked
                            ? "text-[var(--figma-color-text-tertiary)] hover:bg-[var(--figma-color-bg-hover)] hover:text-[var(--figma-color-text)] italic"
                            : "text-[var(--figma-color-text-secondary)] hover:bg-[var(--figma-color-bg-hover)] hover:text-[var(--figma-color-text)]"
                        )}
                        title={c}
                      >
                        <span className="truncate">{c}</span>
                        {isMissing && <CircleHelp className={cn("w-3 h-3 shrink-0 transition-opacity", isSelected ? "text-white opacity-100" : "text-[#f24822] opacity-80 group-hover:opacity-100")} />}
                        {isHardcoded && <Unlink className={cn("w-3 h-3 shrink-0 transition-opacity", isSelected ? "text-white opacity-100" : "text-[var(--figma-color-text-tertiary)] opacity-80 group-hover:opacity-100")} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <Checkbox
                            label=""
                            checked={item.isChecked}
                            indeterminate={item.isIndeterminate}
                            onChange={e => toggleVariableSelection(item.id, e.target.checked)}
                          />
                        </div>

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
                  const compositeKey = `${n.id}::${n.variableName}::${n.groupName}`;
                  const status = nodeStatus.get(compositeKey) ?? 'idle';
                  const errMsg = nodeErrors.get(compositeKey);
                  const isFading = fadingIds.has(compositeKey);

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
                          onChange={e => toggleNodeSelection(compositeKey, e.target.checked)}
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
                  <div onClick={e => e.stopPropagation()} className="shrink-0">
                    <Checkbox
                      label=""
                      checked={activeOverlayVariable.isChecked}
                      indeterminate={activeOverlayVariable.isIndeterminate}
                      onChange={e => toggleVariableSelection(activeOverlayVariable.id, e.target.checked)}
                    />
                  </div>
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

    </div>
  );
}
