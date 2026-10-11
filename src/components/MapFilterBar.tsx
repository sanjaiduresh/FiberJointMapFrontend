import { useState } from 'react';
import type { Wire, JointType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Filter, X, Cable, CircleDot, Circle, Scissors, Building2, Shapes
} from 'lucide-react';
import { JOINT_ICON_OPTIONS, buildJointSVG } from './MapView';

export interface MapFilters {
  wireIds: string[];
  jointTypes: JointType[];
  cableType: 'Single Mode' | 'Multi Mode' | null;
  iconTypes: string[];
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

const EMPTY_FILTERS: MapFilters = { wireIds: [], jointTypes: [], cableType: null, iconTypes: [] };

export default function MapFilterBar({ wires, filters, onChange, counts }: MapFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const isFiltering = filters.wireIds.length > 0 || filters.jointTypes.length > 0 || filters.cableType !== null || filters.iconTypes.length > 0;
  const activeCount = (filters.wireIds.length > 0 ? 1 : 0) + (filters.jointTypes.length > 0 ? 1 : 0) + (filters.cableType ? 1 : 0) + (filters.iconTypes.length > 0 ? 1 : 0);

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

  const toggleWire = (wId: string) => {
    const current = filters.wireIds;
    const next = current.includes(wId)
      ? current.filter(id => id !== wId)
      : [...current, wId];
    onChange({ ...filters, wireIds: next });
  };

  const setCableFilter = (cableType: 'Single Mode' | 'Multi Mode' | null) => {
    onChange({ ...filters, cableType });
  };

  const toggleIconType = (iconKey: string) => {
    const current = filters.iconTypes;
    const next = current.includes(iconKey)
      ? current.filter(k => k !== iconKey)
      : [...current, iconKey];
    onChange({ ...filters, iconTypes: next });
  };

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

      {/* Expanded Filter Panel */}
      {expanded && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-3 w-64 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">

          {/* Wire Filter */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Cable className="size-3" /> Wire Filter
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
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm hover:bg-emerald-200'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className="size-4 flex items-center justify-center shrink-0 [&_svg]:!size-3"
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

    </div>
  );
}
