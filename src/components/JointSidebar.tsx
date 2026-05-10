import { useState, useMemo } from 'react';
import type { FiberJoint, Segment } from '../types';
import type { JointType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Trash2, ChevronDown, ChevronUp, Settings, Route, MapPin, Building2, CircleDot, Circle, Scissors, Edit3, Navigation } from 'lucide-react';

type FilterType = 'all' | 'main' | 'sub' | 'splice';

interface SidebarProps {
  joints: FiberJoint[];
  segments: Segment[];
  onFlyTo: (lat: number, lng: number) => void;
  onEditJoint?: (id: string) => void;
  onDeleteJoint: (id: string) => void;
  onTraceRoute: (fromId: string, toId: string) => void;
  traceMode: boolean;
  onToggleTraceMode: () => void;
  traceFrom: string | null;
  onOpenSettings: () => void;
}

const TYPE_CONFIG: Record<JointType, { icon: React.ElementType; label: string; dot: string; badge: string }> = {
  Base:   { icon: Building2, label: 'Base',   dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  Main:   { icon: CircleDot, label: 'Main',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  Sub:    { icon: Circle,    label: 'Sub',    dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  Splice: { icon: Scissors,  label: 'Splice', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function Sidebar({
  joints, segments, onFlyTo, onEditJoint, onDeleteJoint,
  onTraceRoute, traceMode, onToggleTraceMode, traceFrom,
  onOpenSettings,
}: SidebarProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedJoint, setExpandedJoint] = useState<string | null>(null);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getJointLabel = (id: string) => joints.find((j) => j.id === id)?.label || 'Unknown';

  const getNeighbors = (jointId: string) =>
    segments
      .filter((s) => s.fromJointId === jointId || s.toJointId === jointId)
      .map((s) => ({
        segment: s,
        neighborId: s.fromJointId === jointId ? s.toJointId : s.fromJointId,
      }));

  // Exclude Base from list — it's shown separately in settings
  const listableJoints = useMemo(
    () => joints.filter((j) => j.jointType !== 'Base'),
    [joints],
  );

  const counts = useMemo(() => ({
    all:    listableJoints.length,
    main:   listableJoints.filter((j) => j.jointType === 'Main').length,
    sub:    listableJoints.filter((j) => j.jointType === 'Sub').length,
    splice: listableJoints.filter((j) => j.jointType === 'Splice').length,
  }), [listableJoints]);

  const filteredJoints = useMemo(() => {
    if (filter === 'all') return listableJoints;
    const map: Record<FilterType, JointType> = {
      all: 'Main', main: 'Main', sub: 'Sub', splice: 'Splice',
    };
    return listableJoints.filter((j) => j.jointType === map[filter]);
  }, [listableJoints, filter]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',    label: 'All',    count: counts.all },
    { key: 'main',   label: 'Main',   count: counts.main },
    { key: 'sub',    label: 'Sub',    count: counts.sub },
    { key: 'splice', label: 'Splice', count: counts.splice },
  ];

  return (
    <div className="flex flex-col h-full">

      {/* Filter Buttons */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="xs"
              className="flex-1 text-[11px]"
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
      </div>

      {/* Trace Route Button */}
      <div className="px-3 py-2 border-b border-border">
        <Button
          variant={traceMode ? 'secondary' : 'outline'}
          size="sm"
          className={cn(
            'w-full',
            traceMode && 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
          )}
          onClick={onToggleTraceMode}
        >
          {traceMode
            ? traceFrom
              ? <><Route className="size-4 mr-2" /> Now click destination joint...</>
              : <><Route className="size-4 mr-2" /> Click a start joint below</>
            : <><Route className="size-4 mr-2" /> Trace Route</>}
        </Button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {filteredJoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="size-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
              <span className="text-muted-foreground flex items-center justify-center">
                {filter === 'main' ? <CircleDot className="size-8" /> : filter === 'sub' ? <Circle className="size-8" /> : filter === 'splice' ? <Scissors className="size-8" /> : <MapPin className="size-8" />}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {filter === 'all'
                ? 'No joints yet'
                : `No ${filter} joints yet`}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Click on the map to add a joint
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJoints.map((joint) => {
              const isExpanded = expandedJoint === joint.id;
              const neighbors = getNeighbors(joint.id);
              const typeCfg = TYPE_CONFIG[joint.jointType ?? 'Main'];

              return (
                <div key={joint.id}>
                  <div
                    className={cn(
                      'group bg-card hover:bg-muted/50 border rounded-xl p-3 transition-all cursor-pointer',
                      traceMode
                        ? 'border-amber-200 hover:border-amber-300'
                        : 'border-border hover:border-primary/30',
                    )}
                    onClick={() => {
                      if (traceMode) {
                        if (!traceFrom) { onTraceRoute(joint.id, ''); }
                        else { onTraceRoute(traceFrom, joint.id); }
                      } else {
                        onFlyTo(joint.lat, joint.lng);
                        setExpandedJoint(isExpanded ? null : joint.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">

                        {/* Title row */}
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn('size-2 rounded-full shrink-0', typeCfg.dot)} />
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {joint.label}
                          </h3>
                          {/* Joint type badge */}
                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border shrink-0',
                            typeCfg.badge,
                          )}>
                            <typeCfg.icon className="size-3 mr-1 shrink-0" /> {typeCfg.label}
                          </span>
                        </div>

                        {/* Notes */}
                        {joint.notes && (
                          <p className="text-xs text-muted-foreground ml-4 line-clamp-2">
                            {joint.notes}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2 ml-4 flex-wrap">
                          <Badge variant="secondary" className="text-[9px] h-4">
                            {joint.cableType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {joint.fiberCount} fibers
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {joint.createdBy?.userName || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(joint.createdAt)}
                          </span>
                        </div>

                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!traceMode && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600"
                            title="Get Direction"
                            onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${joint.lat},${joint.lng}`, '_blank'); }}
                          >
                            <Navigation className="size-3.5" />
                          </Button>
                        )}
                        {!traceMode && onEditJoint && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600"
                            onClick={(e) => { e.stopPropagation(); onEditJoint(joint.id); }}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                        )}
                        {!traceMode && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDeleteJoint(joint.id); }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                        {!traceMode && (
                          isExpanded
                            ? <ChevronUp className="size-3.5 text-muted-foreground" />
                            : <ChevronDown className="size-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded — connections */}
                  {isExpanded && !traceMode && (
                    <div className="ml-4 mt-1 p-3 bg-muted border border-border rounded-xl space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Connections ({neighbors.length})
                      </p>
                      {neighbors.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70">No connections yet</p>
                      ) : (
                        neighbors.map(({ segment, neighborId }) => {
                          const neighborJoint = joints.find((j) => j.id === neighborId);
                          const neighborCfg = TYPE_CONFIG[neighborJoint?.jointType ?? 'Main'];
                          return (
                            <div
                              key={segment.id}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                const nj = joints.find((j) => j.id === neighborId);
                                if (nj) onFlyTo(nj.lat, nj.lng);
                              }}
                            >
                              <div className={cn('size-1.5 rounded-full shrink-0', neighborCfg.dot)} />
                              <span className="flex items-center gap-1.5 text-foreground font-medium">
                                <neighborCfg.icon className="size-3 text-muted-foreground shrink-0" />
                                {getJointLabel(neighborId)}
                              </span>
                              <span className="text-muted-foreground ml-auto shrink-0">
                                {segment.lengthMeters >= 1000
                                  ? `${(segment.lengthMeters / 1000).toFixed(2)}km`
                                  : `${segment.lengthMeters.toFixed(0)}m`}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — Settings */}
      <div className="px-4 py-3 border-t border-border bg-muted/40">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
          onClick={onOpenSettings}
        >
          <Settings className="size-3.5" />
          Settings
        </Button>
      </div>

    </div>
  );
}