import { useState } from 'react';
import type { CreateCutPayload, Segment, FiberJoint } from '../types';

interface AddCutModalProps {
  lat: number;
  lng: number;
  segments: Segment[];
  joints: FiberJoint[];
  onSubmit: (payload: CreateCutPayload) => Promise<void>;
  onClose: () => void;
}

export default function AddCutModal({ lat, lng, segments, joints, onSubmit, onClose }: AddCutModalProps) {
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [description, setDescription] = useState('');
  const [segmentId, setSegmentId] = useState(segments.length > 0 ? segments[0].id : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getJointLabel = (jointId: string) => {
    const joint = joints.find((j) => j.id === jointId);
    return joint ? joint.label : 'Unknown';
  };

  const getSegmentLabel = (segment: Segment) => {
    const fromLabel = getJointLabel(segment.fromJointId);
    const toLabel = getJointLabel(segment.toJointId);
    return `${fromLabel} → ${toLabel} (${segment.cableType}, ${segment.fiberCount} fibers)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentId) {
      setError('Please select a segment');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ lat, lng, severity, description: description.trim(), segmentId });
      onClose();
    } catch {
      setError('Failed to mark cut');
    } finally {
      setSubmitting(false);
    }
  };

  const severityColors: Record<string, string> = {
    Low: 'text-yellow-400',
    Medium: 'text-orange-400',
    High: 'text-red-400',
    Critical: 'text-red-500',
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-600/50 rounded-2xl shadow-2xl shadow-red-500/10 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mark Cable Cut</h2>
              <p className="text-xs text-slate-400">Report a fiber fault</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Coordinates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Latitude</label>
              <div className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-red-400 font-mono">
                {lat.toFixed(6)}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Longitude</label>
              <div className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-red-400 font-mono">
                {lng.toFixed(6)}
              </div>
            </div>
          </div>

          {/* Segment selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Affected Segment <span className="text-red-400">*</span>
            </label>
            {segments.length === 0 ? (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                No segments exist yet. Create a connection between two joints first.
              </p>
            ) : (
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
              >
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    {getSegmentLabel(seg)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Severity <span className="text-red-400">*</span>
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className={`w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all ${severityColors[severity]}`}
            >
              <option value="Low">🟡 Low</option>
              <option value="Medium">🟠 Medium</option>
              <option value="High">🔴 High</option>
              <option value="Critical">🚨 Critical</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the cut/fault..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || segments.length === 0}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Mark Cut'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
