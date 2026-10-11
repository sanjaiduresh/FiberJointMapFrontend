import { useState } from 'react';
import type { Wire, JointType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Filter, X, Cable, CircleDot, Circle, Scissors, Building2, Shapes, EyeOff, Eye,
} from 'lucide-react';
import { JOINT_ICON_OPTIONS, buildJointSVG } from './MapView';

export interface MapFilters {
  wireIds: string[];
  jointTypes: JointType[];
  cableType: 'Single Mode' | 'Multi Mode' | null;
  iconTypes: string[];
  excludeMode: boolean;
}

interface MapFilterBarProps {
  wires: Wire[];
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  /** Counts for display */
  counts: {
    visibleSegments: number;
    visibleJoints: number;
    totalSegments: number;
    totalJoints: number;
  };
}

const JOINT_TYPE_CONFIG: { type: JointType; icon: React.ElementType; label: string; color: string; excludeColor: string; dot: string }[] = [
  { type: 'Base', icon: Building2, label: 'Base', color: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200', excludeColor: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', dot: 'bg-orange-500' },
  { type: 'Main', icon: CircleDot, label: 'Main', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', excludeColor: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', dot: 'bg-blue-500' },
  { type: 'Sub', icon: Circle, label: 'Sub', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', excludeColor: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', dot: 'bg-yellow-500' },
  { type: 'Splice', icon: Scissors, label: 'Splice', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', excludeColor: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', dot: 'bg-purple-500' },
];

export const EMPTY_FILTERS: MapFilters = { wireIds: [], jointTypes: [], cableType: null, iconTypes: [], excludeMode: false };

export default function MapFilterBar({ wires, filters, onChange, counts }: MapFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const hasSelections = filters.wireIds.length > 0 || filters.jointTypes.length > 0 || filters.cableType !== null || filters.iconTypes.length > 0;
  const isFiltering = hasSelections;
  const activeCount = (filters.wireIds.length > 0 ? 1 : 0) + (filters.jointTypes.length > 0 ? 1 : 0) + (filters.cableType ? 1 : 0) + (filters.iconTypes.length > 0 ? 1 : 0);

  const handleClear = () => onChange(EMPTY_FILTERS);

  const toggleJointType = (type: JointType) => {
    const next = filters.jointTypes.includes(type)
      ? filters.jointTypes.filter(t => t !== type)
      : [...filters.jointTypes, type];
    onChange({ ...filters, jointTypes: next });
  };

  const toggleWire = (wId: string) => {
    const next = filters.wireIds.includes(wId)
      ? filters.wireIds.filter(id => id !== wId)
      : [...filters.wireIds, wId];
    onChange({ ...filters, wireIds: next });
  };

  const setCableFilter = (cableType: 'Single Mode' | 'Multi Mode' | null) => {
    onChange({ ...filters, cableType });
  };

  const toggleIconType = (iconKey: string) => {
    const next = filters.iconTypes.includes(iconKey)
      ? filters.iconTypes.filter(k => k !== iconKey)
      : [...filters.iconTypes, iconKey];
    onChange({ ...filters, iconTypes: next });
  };

  const toggleExcludeMode = () => {
    onChange({ ...filters, excludeMode: !filters.excludeMode });
  };

  // Active button colours depend on exclude mode
  const activeWireClass = filters.excludeMode
    ? 'bg-red-500 text-white border-red-500 shadow-sm'
    : 'bg-primary text-primary-foreground border-primary shadow-sm';
  const activeCableClass = filters.excludeMode
    ? 'bg-red-500 text-white border-red-500 shadow-sm'
    : 'bg-primary text-primary-foreground border-primary shadow-sm';
  const activeIconClass = filters.excludeMode
    ? 'bg-red-100 text-red-700 border-red-200 shadow-sm hover:bg-red-200'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm hover:bg-emerald-200';

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'bg-card shadow-sm relative transition-all',
          isFiltering
            ? filters.excludeMode
              ? 'border-red-400/60 hover:border-red-500 text-red-500 hover:bg-red-50'
              : 'border-primary/50 hover:border-primary text-primary hover:bg-primary/5'
            : 'hover:bg-muted',
          expanded && 'bg-muted',
        )}
        title="Filter Map"
      >
        <Filter className="size-4" />
        {isFiltering && !expanded && (
          <Badge className={cn(
            'absolute -top-1.5 -right-1.5 size-4 p-0 justify-center text-[9px] shadow-sm',
            filters.excludeMode ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground',
          )}>
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Expanded Filter Panel */}
      {expanded && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl w-64 animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col max-h-[calc(100vh-10rem)]">
          {/* Header with exclude toggle — always visible */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border shrink-0">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Map Filters</span>
            <button
              onClick={toggleExcludeMode}
              title={filters.excludeMode ? 'Exclude mode: hiding selected' : 'Include mode: showing selected'}
              className={cn(
                'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                filters.excludeMode
                  ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
              )}
            >
              {filters.excludeMode ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {filters.excludeMode ? 'Exclude' : 'Include'}
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto p-3 space-y-3 flex-1 min-h-0">

            {/* Wire Filter */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Cable className="size-3" /> Wire
              </p>
              <div className="flex flex-wrap gap-1">
                {wires.map((w) => {
                  const isActive = filters.wireIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleWire(w.id)}
                      className={cn(
                        'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex items-center gap-1.5',
                        isActive
                          ? activeWireClass
                          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: w.color }}
                      />
                      {w.name}
                    </button>
                  );
                })}
                {wires.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/60 italic">No wires created</span>
                )}
              </div>
            </div>

            {/* Joint Type Filter */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Joint Types
              </p>
              <div className="flex flex-wrap gap-1">
                {JOINT_TYPE_CONFIG.map(({ type, icon: Icon, label, color, excludeColor, dot }) => {
                  const isActive = filters.jointTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleJointType(type)}
                      className={cn(
                        'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex items-center gap-1.5',
                        isActive
                          ? (filters.excludeMode ? excludeColor : color) + ' shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span className={cn('size-2 rounded-full shrink-0', isActive ? dot : 'bg-muted-foreground/30')} />
                      <Icon className="size-3" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon Type Filter */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Shapes className="size-3" /> Icon Type
              </p>
              <div className="flex flex-wrap gap-1">
                {JOINT_ICON_OPTIONS.map((opt) => {
                  const isActive = filters.iconTypes.includes(opt.key);
                  const { svg } = buildJointSVG('Main', opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleIconType(opt.key)}
                      className={cn(
                        'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex items-center gap-1.5',
                        isActive
                          ? activeIconClass
                          : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span
                        className="size-4 flex items-center justify-center shrink-0"
                        dangerouslySetInnerHTML={{ __html: svg }}
                        style={{ transform: 'scale(0.55)' }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cable Type Filter */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Cable Type
              </p>
              <div className="flex gap-1">
                {(['Single Mode', 'Multi Mode'] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setCableFilter(filters.cableType === ct ? null : ct)}
                    className={cn(
                      'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex-1',
                      filters.cableType === ct
                        ? activeCableClass
                        : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer counts — always visible */}
          {isFiltering && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0">
              <span className="text-[10px] text-muted-foreground">
                <strong className="text-foreground">{counts.visibleJoints}</strong>/{counts.totalJoints} joints · <strong className="text-foreground">{counts.visibleSegments}</strong>/{counts.totalSegments} segs
              </span>
              <button
                onClick={handleClear}
                className="text-[10px] text-destructive hover:text-destructive/80 font-medium flex items-center gap-0.5"
              >
                <X className="size-3" /> Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
