import { useState } from 'react';
import type { Wire, JointType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Filter, X, Cable, CircleDot, Circle, Scissors, Building2, ChevronDown,
} from 'lucide-react';

export interface MapFilters {
  wireId: string | null;
  jointTypes: JointType[];
  cableType: 'Single Mode' | 'Multi Mode' | null;
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

const JOINT_TYPE_CONFIG: { type: JointType; icon: React.ElementType; label: string; color: string; dot: string }[] = [
  { type: 'Base', icon: Building2, label: 'Base', color: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200', dot: 'bg-orange-500' },
  { type: 'Main', icon: CircleDot, label: 'Main', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', dot: 'bg-blue-500' },
  { type: 'Sub', icon: Circle, label: 'Sub', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', dot: 'bg-yellow-500' },
  { type: 'Splice', icon: Scissors, label: 'Splice', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', dot: 'bg-purple-500' },
];

const EMPTY_FILTERS: MapFilters = { wireId: null, jointTypes: [], cableType: null };

export default function MapFilterBar({ wires, filters, onChange, counts }: MapFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const isFiltering = filters.wireId !== null || filters.jointTypes.length > 0 || filters.cableType !== null;
  const activeCount = (filters.wireId ? 1 : 0) + (filters.jointTypes.length > 0 ? 1 : 0) + (filters.cableType ? 1 : 0);

  const handleClear = () => {
    onChange(EMPTY_FILTERS);
  };

  const toggleJointType = (type: JointType) => {
    const current = filters.jointTypes;
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    onChange({ ...filters, jointTypes: next });
  };

  const setWireFilter = (wireId: string | null) => {
    onChange({ ...filters, wireId });
  };

  const setCableFilter = (cableType: 'Single Mode' | 'Multi Mode' | null) => {
    onChange({ ...filters, cableType });
  };

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {/* Expanded Filter Panel */}
      {expanded && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-3 w-64 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">

          {/* Wire Filter */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Cable className="size-3" /> Wire Filter
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setWireFilter(null)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-md border transition-all font-medium',
                  !filters.wireId
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                )}
              >
                All wires
              </button>
              {wires.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWireFilter(filters.wireId === w.id ? null : w.id)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex items-center gap-1.5',
                    filters.wireId === w.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                    style={{ backgroundColor: w.color }}
                  />
                  {w.name}
                </button>
              ))}
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
              {JOINT_TYPE_CONFIG.map(({ type, icon: Icon, label, color, dot }) => {
                const isActive = filters.jointTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleJointType(type)}
                    className={cn(
                      'text-[10px] px-2 py-1 rounded-md border transition-all font-medium flex items-center gap-1.5',
                      isActive
                        ? color + ' shadow-sm'
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
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                  )}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {/* Counts */}
          {isFiltering && (
            <div className="flex items-center justify-between pt-1.5 border-t border-border">
              <span className="text-[10px] text-muted-foreground">
                Showing <strong className="text-foreground">{counts.visibleJoints}</strong>/{counts.totalJoints} joints · <strong className="text-foreground">{counts.visibleSegments}</strong>/{counts.totalSegments} segments
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

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'bg-card shadow-sm relative transition-all',
          isFiltering
            ? 'border-primary/50 hover:border-primary text-primary hover:bg-primary/5'
            : 'hover:bg-muted',
          expanded && 'bg-muted',
        )}
        title="Filter Map"
      >
        <Filter className="size-4" />
        {isFiltering && !expanded && (
          <Badge className="absolute -top-1.5 -right-1.5 size-4 p-0 justify-center text-[9px] bg-primary text-primary-foreground shadow-sm">
            {activeCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}
