import { useState } from 'react';
import type { CreateSegmentPayload, FiberJoint } from '../types';

interface AddConnectionModalProps {
  joints: FiberJoint[];
  onSubmit: (payload: CreateSegmentPayload) => Promise<void>;
  onClose: () => void;
}

export default function AddConnectionModal({ joints, onSubmit, onClose }: AddConnectionModalProps) {
  const [fromJointId, setFromJointId] = useState(joints.length > 0 ? joints[0].id : '');
  const [toJointId, setToJointId] = useState(joints.length > 1 ? joints[1].id : '');
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>('Single Mode');
  const [fiberCount, setFiberCount] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromJointId || !toJointId) {
      setError('Please select both joints');
      return;
    }
    if (fromJointId === toJointId) {
      setError('Cannot connect a joint to itself');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ fromJointId, toJointId, cableType, fiberCount });
      onClose();
    } catch {
      setError('Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-600/50 rounded-2xl shadow-2xl shadow-purple-500/10 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Add Connection</h2>
              <p className="text-xs text-slate-400">Connect two fiber joints</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {joints.length < 2 ? (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-3">
              ⚠️ You need at least 2 joints to create a connection. Add joints to the map first.
            </div>
          ) : (
            <>
              {/* From Joint */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  From Joint <span className="text-red-400">*</span>
                </label>
                <select
                  value={fromJointId}
                  onChange={(e) => setFromJointId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                >
                  {joints.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.label} ({j.cableType}, {j.fiberCount} fibers)
                    </option>
                  ))}
                </select>
              </div>

              {/* To Joint */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  To Joint <span className="text-red-400">*</span>
                </label>
                <select
                  value={toJointId}
                  onChange={(e) => setToJointId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                >
                  {joints.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.label} ({j.cableType}, {j.fiberCount} fibers)
                    </option>
                  ))}
                </select>
              </div>

              {/* Cable Type + Fiber Count */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Cable Type</label>
                  <select
                    value={cableType}
                    onChange={(e) => setCableType(e.target.value as typeof cableType)}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  >
                    <option value="Single Mode">Single Mode</option>
                    <option value="Multi Mode">Multi Mode</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Fiber Count</label>
                  <input
                    type="number"
                    min={1}
                    value={fiberCount}
                    onChange={(e) => setFiberCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>
            </>
          )}

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
              disabled={submitting || joints.length < 2}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                'Create Connection'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
