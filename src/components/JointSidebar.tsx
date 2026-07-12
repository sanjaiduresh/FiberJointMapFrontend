import { useState, useMemo } from 'react';
import type { FiberJoint, Segment, UserRole, Wire, JointType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Trash2, ChevronDown, ChevronUp, Settings, Route, MapPin, Building2,
  CircleDot, Circle, Scissors, Edit3, Navigation, CheckCircle2, XCircle,
  Clock, Users, Cable, AlertTriangle, ArrowUpDown, LayoutList, Network,
  Copy, ExternalLink
} from 'lucide-react';

type FilterType = 'all' | 'main' | 'sub' | 'splice';
type SortType = 'date' | 'name' | 'connections';
type ViewType = 'list' | 'grouped';

interface SidebarProps {
  joints: FiberJoint[];
  segments: Segment[];
  wires: Wire[];
  wiresById: Map<string, Wire>;
  onFlyTo: (lat: number, lng: number) => void;
  onEditJoint?: (id: string) => void;
  onDeleteJoint: (id: string) => void;
  onTraceRoute: (fromId: string, toId: string) => void;
  traceMode: boolean;
  onToggleTraceMode: () => void;
  traceFrom: string | null;
  onOpenSettings: () => void;
  userRole: UserRole | null;
  onApproveJoint?: (id: string) => void;
  onRejectJoint?: (id: string) => void;
  isDraftMap?: boolean;
  onOpenTeamManagement?: () => void;
  onHighlight?: (jointId: string | null, segmentIds: string[]) => void;
}

const TYPE_CONFIG: Record<JointType, { icon: React.ElementType; label: string; dot: string; badge: string }> = {
  Base:   { icon: Building2, label: 'Base',   dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  Main:   { icon: CircleDot, label: 'Main',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  Sub:    { icon: Circle,    label: 'Sub',    dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  Splice: { icon: Scissors,  label: 'Splice', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function Sidebar({
  joints, segments, wires, wiresById, onFlyTo, onEditJoint, onDeleteJoint,
  onTraceRoute, traceMode, onToggleTraceMode, traceFrom,
  onOpenSettings, userRole, onApproveJoint, onRejectJoint,
  isDraftMap, onOpenTeamManagement, onHighlight,
}: SidebarProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedJoint, setExpandedJoint] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [viewType, setViewType] = useState<ViewType>('list');

  const isOwner = userRole === 'OWNER';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getJointLabel = (id: string) => joints.find((j) => j.id === id)?.label || 'Unknown';

  // Precompute neighbor info for all joints
  const neighborMap = useMemo(() => {
    const map = new Map<string, Array<{ segment: Segment; neighborId: string }>>();
    joints.forEach(j => map.set(j.id, []));
    segments.forEach(s => {
      map.get(s.fromJointId)?.push({ segment: s, neighborId: s.toJointId });
      map.get(s.toJointId)?.push({ segment: s, neighborId: s.fromJointId });
    });
    return map;
  }, [joints, segments]);

  // Wires passing through each joint
  const jointWires = useMemo(() => {
    const map = new Map<string, Set<string>>();
    segments.forEach(s => {
      if (!s.wireId) return;
      [s.fromJointId, s.toJointId].forEach(jId => {
        if (!map.has(jId)) map.set(jId, new Set());
        map.get(jId)!.add(s.wireId!);
      });
    });
    return map;
  }, [segments]);

  // Cable length per joint
  const jointCableLength = useMemo(() => {
    const map = new Map<string, number>();
    segments.forEach(s => {
      [s.fromJointId, s.toJointId].forEach(jId => {
        map.set(jId, (map.get(jId) || 0) + s.lengthMeters / 2);
      });
    });
    return map;
  }, [segments]);

  // Network stats
  const stats = useMemo(() => {
    const totalKm = segments.reduce((a, s) => a + s.lengthMeters, 0) / 1000;
    const unconnected = joints.filter(j => (neighborMap.get(j.id)?.length || 0) === 0);
    const hubJoints = joints.filter(j => (neighborMap.get(j.id)?.length || 0) >= 3);
    // Wire breakdown
    const wireStats = wires.map(w => {
      const segs = segments.filter(s => s.wireId === w.id);
      const km = segs.reduce((a, s) => a + s.lengthMeters, 0) / 1000;
      return { wire: w, segCount: segs.length, km };
    }).filter(ws => ws.segCount > 0);
    const unassigned = segments.filter(s => !s.wireId).length;
    return { totalKm, unconnected, hubJoints, wireStats, unassigned };
  }, [joints, segments, neighborMap, wires]);

  // Exclude Base from list
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

  const filteredAndSorted = useMemo(() => {
    let result = filter === 'all' ? listableJoints : listableJoints.filter((j) => {
      const map: Record<FilterType, JointType> = { all: 'Main', main: 'Main', sub: 'Sub', splice: 'Splice' };
      return j.jointType === map[filter];
    });
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.label.localeCompare(b.label);
      if (sortBy === 'connections') return (neighborMap.get(b.id)?.length || 0) - (neighborMap.get(a.id)?.length || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [listableJoints, filter, sortBy, neighborMap]);

  // Grouped by wire view
  const groupedByWire = useMemo(() => {
    if (viewType !== 'grouped') return [];
    const groups: Array<{ wire: Wire | null; label: string; color: string; joints: FiberJoint[] }> = [];
    const assigned = new Set<string>();

    wires.forEach(w => {
      const jointIds = new Set<string>();
      segments.filter(s => s.wireId === w.id).forEach(s => {
        jointIds.add(s.fromJointId);
        jointIds.add(s.toJointId);
      });
      const wJoints = filteredAndSorted.filter(j => jointIds.has(j.id));
      if (wJoints.length > 0) {
        groups.push({ wire: w, label: w.name, color: w.color, joints: wJoints });
        wJoints.forEach(j => assigned.add(j.id));
      }
    });

    const unassignedJoints = filteredAndSorted.filter(j => !assigned.has(j.id));
    if (unassignedJoints.length > 0) {
      groups.push({ wire: null, label: 'Unassigned', color: '#6b7280', joints: unassignedJoints });
    }
    return groups;
  }, [viewType, wires, segments, filteredAndSorted]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',    label: 'All',    count: counts.all },
    { key: 'main',   label: 'Main',   count: counts.main },
    { key: 'sub',    label: 'Sub',    count: counts.sub },
    { key: 'splice', label: 'Splice', count: counts.splice },
  ];

  // ── Joint Card Component ──
  const JointCard = ({ joint }: { joint: FiberJoint }) => {
    const isExpanded = expandedJoint === joint.id;
    const neighbors = neighborMap.get(joint.id) || [];
    const typeCfg = TYPE_CONFIG[joint.jointType ?? 'Main'];
    const isPending = joint.approvalStatus === 'PENDING';
    const connCount = neighbors.length;
    const wireIds = jointWires.get(joint.id);
    const cableLen = jointCableLength.get(joint.id) || 0;

    return (
      <div key={joint.id}>
        <div
          className={cn(
            'group bg-card hover:bg-muted/50 border rounded-xl p-3 transition-all cursor-pointer',
            traceMode
              ? 'border-amber-200 hover:border-amber-300'
              : isPending
                ? 'border-amber-300 bg-amber-50/30'
                : connCount === 0
                  ? 'border-red-200/60 bg-red-50/20'
                  : 'border-border hover:border-primary/30',
          )}
          onClick={() => {
            if (traceMode) {
              if (!traceFrom) onTraceRoute(joint.id, '');
              else onTraceRoute(traceFrom, joint.id);
            } else {
              onFlyTo(joint.lat, joint.lng);
              const newExpanded = isExpanded ? null : joint.id;
              setExpandedJoint(newExpanded);
              
              if (newExpanded) {
                const neighborSegmentIds = (neighborMap.get(joint.id) || []).map(n => n.segment.id);
                onHighlight?.(joint.id, neighborSegmentIds);
              } else {
                onHighlight?.(null, []);
              }
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1">
                <div className={cn('size-2 rounded-full shrink-0', isPending ? 'bg-amber-500 animate-pulse' : typeCfg.dot)} />
                <h3 className="text-sm font-semibold text-foreground truncate">{joint.label}</h3>
                <span className={cn('inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border shrink-0', typeCfg.badge)}>
                  <typeCfg.icon className="size-3 mr-1 shrink-0" /> {typeCfg.label}
                </span>
                {isPending && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-medium border shrink-0 bg-amber-100 text-amber-700 border-amber-200">
                    <Clock className="size-2.5" /> Pending
                  </span>
                )}
              </div>

              {joint.notes && <p className="text-xs text-muted-foreground ml-4 line-clamp-1">{joint.notes}</p>}

              {/* Stats row — connections + wire colors + cable length */}
              <div className="flex items-center gap-2 mt-1.5 ml-4 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border',
                  connCount === 0
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : connCount >= 3
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-muted text-muted-foreground border-border',
                )}>
                  <Network className="size-3" />
                  {connCount} {connCount === 1 ? 'conn' : 'conns'}
                </span>
                {cableLen > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {cableLen >= 1000 ? `${(cableLen / 1000).toFixed(1)}km` : `${cableLen.toFixed(0)}m`}
                  </span>
                )}
                {/* Wire color dots */}
                {wireIds && wireIds.size > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from(wireIds).slice(0, 4).map(wId => {
                      const w = wiresById.get(wId);
                      return w ? (
                        <span key={wId} title={w.name} className="size-3 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: w.color }} />
                      ) : null;
                    })}
                    {wireIds.size > 4 && <span className="text-[9px] text-muted-foreground">+{wireIds.size - 4}</span>}
                  </span>
                )}
              </div>

              {/* Pending Approval */}
              {isPending && isOwner && isDraftMap && (
                <div className="flex items-center gap-2 mt-2 ml-4">
                  <Button variant="outline" size="xs" className="text-[10px] h-6 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={(e) => { e.stopPropagation(); onApproveJoint?.(joint.id); }}>
                    <CheckCircle2 className="size-3" /> Approve
                  </Button>
                  <Button variant="outline" size="xs" className="text-[10px] h-6 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); onRejectJoint?.(joint.id); }}>
                    <XCircle className="size-3" /> Reject
                  </Button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {!traceMode && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600" title="Copy Coordinates"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${joint.lat}, ${joint.lng}`); }}>
                  <Copy className="size-3.5" />
                </Button>
              )}
              {!traceMode && onEditJoint && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-600"
                  onClick={(e) => { e.stopPropagation(); onEditJoint(joint.id); }}>
                  <Edit3 className="size-3.5" />
                </Button>
              )}
              {!traceMode && isOwner && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDeleteJoint(joint.id); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
              {!traceMode && (isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />)}
            </div>
          </div>
        </div>

        {/* Expanded — connections & actions */}
        {isExpanded && !traceMode && (
          <div className="ml-4 mt-1 p-3 bg-muted border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Connections ({neighbors.length})
              </p>
            </div>
            {neighbors.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <AlertTriangle className="size-3.5 text-amber-500" />
                <p className="text-xs text-amber-600">No connections — this joint is isolated</p>
              </div>
            ) : (
              neighbors.map(({ segment, neighborId }) => {
                const neighborJoint = joints.find((j) => j.id === neighborId);
                const neighborCfg = TYPE_CONFIG[neighborJoint?.jointType ?? 'Main'];
                const wire = segment.wireId ? wiresById.get(segment.wireId) : null;
                return (
                  <div key={segment.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors group/conn"
                    onMouseEnter={() => onHighlight?.(null, [segment.id])}
                    onMouseLeave={() => onHighlight?.(joint.id, neighbors.map(n => n.segment.id))}
                    onClick={() => { const nj = joints.find((j) => j.id === neighborId); if (nj) onFlyTo(nj.lat, nj.lng); }}>
                    <div className={cn('size-1.5 rounded-full shrink-0', neighborCfg.dot)} />
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <neighborCfg.icon className="size-3 text-muted-foreground shrink-0" />
                      {getJointLabel(neighborId)}
                    </span>
                    {wire && (
                      <span className="size-2.5 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: wire.color }} title={wire.name} />
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 pr-1">
                      {segment.lengthMeters >= 1000 ? `${(segment.lengthMeters / 1000).toFixed(2)}km` : `${segment.lengthMeters.toFixed(0)}m`}
                    </span>
                    {neighborJoint && (
                      <Button variant="ghost" size="icon-xs" className="h-5 w-5 shrink-0 opacity-0 group-hover/conn:opacity-100 text-muted-foreground hover:text-blue-600" title="Get Direction"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&origin=${joint.lat},${joint.lng}&destination=${neighborJoint.lat},${neighborJoint.lng}`, '_blank'); }}>
                        <Navigation className="size-3" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Filter + Controls */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <Button key={f.key} variant={filter === f.key ? 'default' : 'outline'} size="xs" className="flex-1 text-[11px]"
              onClick={() => setFilter(f.key)}>
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={traceMode ? 'secondary' : 'outline'} size="xs" className={cn('flex-1 text-[11px]', traceMode && 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100')}
            onClick={onToggleTraceMode}>
            <Route className="size-3 mr-1" />
            {traceMode ? (traceFrom ? 'Click destination...' : 'Click start joint') : 'Trace Route'}
          </Button>
          {/* Sort */}
          <Button variant="outline" size="xs" className="text-[11px] gap-1 px-2" title={`Sort by ${sortBy}`}
            onClick={() => setSortBy(s => s === 'date' ? 'name' : s === 'name' ? 'connections' : 'date')}>
            <ArrowUpDown className="size-3" />
            {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Conns'}
          </Button>
          {/* View toggle */}
          {wires.length > 0 && (
            <Button variant="outline" size="xs" className="text-[11px] gap-1 px-2" title={viewType === 'list' ? 'Group by wire' : 'List view'}
              onClick={() => setViewType(v => v === 'list' ? 'grouped' : 'list')}>
              {viewType === 'list' ? <Cable className="size-3" /> : <LayoutList className="size-3" />}
            </Button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="size-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
              <span className="text-muted-foreground flex items-center justify-center">
                {filter === 'main' ? <CircleDot className="size-8" /> : filter === 'sub' ? <Circle className="size-8" /> : filter === 'splice' ? <Scissors className="size-8" /> : <MapPin className="size-8" />}
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{filter === 'all' ? 'No joints yet' : `No ${filter} joints yet`}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{isDraftMap ? 'Switch to Draft Map to add joints' : 'Click on the map to add a joint'}</p>
          </div>
        ) : viewType === 'grouped' && groupedByWire.length > 0 ? (
          <div className="space-y-4">
            {groupedByWire.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="size-3 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: group.color }} />
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">{group.label}</p>
                  <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{group.joints.length}</Badge>
                </div>
                <div className="space-y-2">
                  {group.joints.map(j => <JointCard key={j.id} joint={j} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSorted.map((joint) => <JointCard key={joint.id} joint={joint} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/40 flex gap-2">
        {isOwner && onOpenTeamManagement && (
          <Button variant="outline" size="sm" className="flex-1 gap-2 text-muted-foreground hover:text-foreground" onClick={onOpenTeamManagement}>
            <Users className="size-3.5" /> Team
          </Button>
        )}
        <Button variant="outline" size="sm" className="flex-1 gap-2 text-muted-foreground hover:text-foreground" onClick={onOpenSettings}>
          <Settings className="size-3.5" /> Settings
        </Button>
      </div>
    </div>
  );
}