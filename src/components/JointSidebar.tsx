import { useState, useMemo } from 'react';
import type { FiberJoint, Cut, Segment } from '../types';

type FilterType = 'all' | 'joints' | 'cuts' | 'fixed';

interface SidebarProps {
  joints: FiberJoint[];
  cuts: Cut[];
  segments: Segment[];
  onFlyTo: (lat: number, lng: number) => void;
  onDeleteJoint: (id: string) => void;
  onTraceRoute: (fromId: string, toId: string) => void;
  traceMode: boolean;
  onToggleTraceMode: () => void;
  traceFrom: string | null;
}

export default function Sidebar({
  joints, cuts, segments, onFlyTo, onDeleteJoint,
  onTraceRoute, traceMode, onToggleTraceMode, traceFrom,
}: SidebarProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getJointLabel = (id: string) => joints.find((j) => j.id === id)?.label || 'Unknown';

  const getNeighbors = (jointId: string) => {
    const connected = segments.filter(
      (s) => s.fromJointId === jointId || s.toJointId === jointId
    );
    return connected.map((s) => ({
      segment: s,
      neighborId: s.fromJointId === jointId ? s.toJointId : s.fromJointId,
    }));
  };

  const getActiveCutsOnSegment = (segId: string) =>
    cuts.filter((c) => c.segmentId === segId && c.status === 'Cut');

  const severityIcon: Record<string, string> = { Low: '🟡', Medium: '🟠', High: '🔴', Critical: '🚨' };

  const filteredItems = useMemo(() => {
    const items: Array<{ type: 'joint'; data: FiberJoint } | { type: 'cut'; data: Cut }> = [];

    if (filter === 'all' || filter === 'joints') {
      joints.forEach((j) => items.push({ type: 'joint', data: j }));
    }
    if (filter === 'all' || filter === 'cuts') {
      cuts.filter((c) => c.status === 'Cut').forEach((c) => items.push({ type: 'cut', data: c }));
    }
    if (filter === 'all' || filter === 'fixed') {
      cuts.filter((c) => c.status === 'Fixed').forEach((c) => items.push({ type: 'cut', data: c }));
    }

    return items;
  }, [joints, cuts, filter]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: joints.length + cuts.length },
    { key: 'joints', label: 'Joints', count: joints.length },
    { key: 'cuts', label: 'Cuts', count: cuts.filter((c) => c.status === 'Cut').length },
    { key: 'fixed', label: 'Fixed', count: cuts.filter((c) => c.status === 'Fixed').length },
  ];

  const [expandedJoint, setExpandedJoint] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Filter Buttons */}
      <div className="px-3 py-2.5 border-b border-slate-800/50">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Trace Route Button */}
      <div className="px-3 py-2 border-b border-slate-800/50">
        <button
          onClick={onToggleTraceMode}
          className={`w-full px-3 py-2 text-xs font-medium rounded-lg transition-all ${
            traceMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-slate-700/30'
          }`}
        >
          {traceMode
            ? traceFrom
              ? `🛤️ Now click destination joint...`
              : '🛤️ Click a start joint below'
            : '🛤️ Trace Route'}
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
              {filter === 'joints' ? (
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : filter === 'cuts' ? (
                <span className="text-3xl">⚠️</span>
              ) : filter === 'fixed' ? (
                <span className="text-3xl">✅</span>
              ) : (
                <span className="text-3xl">📍</span>
              )}
            </div>
            <p className="text-sm text-slate-400 font-medium">
              {filter === 'joints' ? 'No joints yet'
                : filter === 'cuts' ? 'No cuts found'
                : filter === 'fixed' ? 'No fixed cuts'
                : 'No items yet'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {filter === 'joints' || filter === 'all'
                ? 'Click on the map to add a joint'
                : 'Mark a cut using the Cut Mode button'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              if (item.type === 'joint') {
                const joint = item.data as FiberJoint;
                const isExpanded = expandedJoint === joint.id;
                const neighbors = getNeighbors(joint.id);
                return (
                  <div key={`j-${joint.id}`}>
                    <div
                      className={`group bg-slate-800/30 hover:bg-slate-800/60 border rounded-xl p-3 transition-all cursor-pointer ${
                        traceMode
                          ? 'border-amber-500/30 hover:border-amber-500/50'
                          : 'border-slate-700/30 hover:border-cyan-500/30'
                      }`}
                      onClick={() => {
                        if (traceMode) {
                          if (!traceFrom) {
                            onTraceRoute(joint.id, '');
                          } else {
                            onTraceRoute(traceFrom, joint.id);
                          }
                        } else {
                          onFlyTo(joint.lat, joint.lng);
                          setExpandedJoint(isExpanded ? null : joint.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 flex-shrink-0" />
                            <h3 className="text-sm font-semibold text-slate-200 truncate">{joint.label}</h3>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded-md">{joint.cableType}</span>
                          </div>
                          {joint.notes && <p className="text-xs text-slate-400 ml-4 line-clamp-2">{joint.notes}</p>}
                          <div className="flex items-center gap-3 mt-2 ml-4">
                            <span className="text-[10px] text-slate-500">{joint.fiberCount} fibers</span>
                            <span className="text-[10px] text-slate-500">by {joint.createdBy?.userName || 'Unknown'}</span>
                            <span className="text-[10px] text-slate-500">{formatDate(joint.createdAt)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteJoint(joint.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-all flex-shrink-0"
                          title="Delete joint"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Expanded detail */}
                    {isExpanded && !traceMode && (
                      <div className="ml-4 mt-1 p-3 bg-slate-800/40 border border-slate-700/30 rounded-xl space-y-2">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Connections ({neighbors.length})</p>
                        {neighbors.length === 0 ? (
                          <p className="text-xs text-slate-500">No connections yet</p>
                        ) : (
                          neighbors.map(({ segment, neighborId }) => {
                            const activeCuts = getActiveCutsOnSegment(segment.id);
                            return (
                              <div key={segment.id} className="flex items-center gap-2 text-xs">
                                <div className={`w-1.5 h-1.5 rounded-full ${activeCuts.length > 0 ? 'bg-red-400' : 'bg-cyan-400'}`} />
                                <span className="text-slate-300">{getJointLabel(neighborId)}</span>
                                <span className="text-slate-500">({segment.lengthMeters.toFixed(0)}m)</span>
                                {activeCuts.length > 0 && (
                                  <span className="text-red-400 text-[10px]">⚠ {activeCuts.length} cut{activeCuts.length > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              } else {
                const cut = item.data as Cut;
                return (
                  <div
                    key={`c-${cut.id}`}
                    className={`group bg-slate-800/30 hover:bg-slate-800/60 border rounded-xl p-3 transition-all cursor-pointer ${
                      cut.status === 'Cut'
                        ? 'border-red-500/20 hover:border-red-500/40'
                        : 'border-green-500/20 hover:border-green-500/40'
                    }`}
                    onClick={() => onFlyTo(cut.lat, cut.lng)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            cut.status === 'Cut' ? 'bg-red-400 shadow-sm shadow-red-400/50' : 'bg-green-400 shadow-sm shadow-green-400/50'
                          }`} />
                          <span className="text-sm font-semibold text-slate-200">
                            {severityIcon[cut.severity]} {cut.severity} Cut
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                            cut.status === 'Cut'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {cut.status}
                          </span>
                        </div>
                        {cut.description && <p className="text-xs text-slate-400 ml-4 line-clamp-2">{cut.description}</p>}
                        <div className="flex items-center gap-3 mt-2 ml-4 flex-wrap">
                          <span className="text-[10px] text-slate-500">by {cut.markedBy.userName}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(cut.createdAt)}</span>
                          {cut.status === 'Fixed' && cut.fixedBy && (
                            <span className="text-[10px] text-green-500">Fixed by {cut.fixedBy.userName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
