import type { FiberJoint } from '../types';

interface JointSidebarProps {
  joints: FiberJoint[];
  onFlyTo: (lat: number, lng: number) => void;
  onDelete: (id: string) => void;
}

export default function JointSidebar({ joints, onFlyTo, onDelete }: JointSidebarProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (joints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm text-slate-400 font-medium">No joints found</p>
        <p className="text-xs text-slate-500 mt-1">Click on the map to add one</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {joints.map((joint) => (
        <div
          key={joint.id}
          className="group bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/30 hover:border-cyan-500/30 rounded-xl p-3 transition-all cursor-pointer"
          onClick={() => onFlyTo(joint.lat, joint.lng)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-slate-200 truncate">{joint.label}</h3>
              </div>
              {joint.notes && (
                <p className="text-xs text-slate-400 ml-4 line-clamp-2">{joint.notes}</p>
              )}
              <div className="flex items-center gap-3 mt-2 ml-4">
                <span className="text-[10px] text-slate-500 font-mono">
                  {joint.lat.toFixed(4)}, {joint.lng.toFixed(4)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatDate(joint.createdAt)}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(joint.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-all flex-shrink-0"
              title="Delete joint"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
