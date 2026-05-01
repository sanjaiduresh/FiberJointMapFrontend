import { useState } from 'react';
import type { SpliceJointPayload, JointType, Segment, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Scissors, Locate, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpliceJointModalProps {
  lat: number;
  lng: number;
  segmentId: string;
  segments: Segment[];
  joints: FiberJoint[];
  onSubmit: (payload: SpliceJointPayload) => Promise<void>;
  onClose: () => void;
  liveLocation?: { lat: number; lng: number; accuracy?: number } | null;
}

const JOINT_TYPES: { value: JointType; label: string; desc: string; color: string }[] = [
  { value: 'Main', label: '🔵 Main', desc: 'Primary distribution', color: 'border-blue-400 bg-blue-50 text-blue-700' },
  { value: 'Sub', label: '🟡 Sub', desc: 'End distribution', color: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  { value: 'Splice', label: '🟣 Splice', desc: 'Mid-cable splice', color: 'border-purple-400 bg-purple-50 text-purple-700' },
];

export default function SpliceJointModal({
  lat, lng, segmentId, segments, joints, onSubmit, onClose, liveLocation,
}: SpliceJointModalProps) {
  const targetSegment = segments.find((s) => s.id === segmentId);
  const fromJoint = joints.find((j) => j.id === targetSegment?.fromJointId);
  const toJoint = joints.find((j) => j.id === targetSegment?.toJointId);

  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [jointType, setJointType] = useState<JointType>('Splice');
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(
    targetSegment?.cableType ?? 'Single Mode',
  );
  const [fiberCount, setFiberCount] = useState(targetSegment?.fiberCount ?? 12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState({ lat, lng });
  const [usingLive, setUsingLive] = useState(false);

  const handleUseMyLocation = () => {
    if (!liveLocation) return;
    setCoords({ lat: liveLocation.lat, lng: liveLocation.lng });
    setUsingLive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError('Label is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        segmentId,
        label: label.trim(),
        notes,
        jointType,
        cableType,
        fiberCount,
        lat: coords.lat,
        lng: coords.lng,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to splice joint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
              <Scissors className="size-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Splice Joint</DialogTitle>
              <DialogDescription>
                Insert a new joint onto this cable segment
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Segment info banner */}
        {targetSegment && fromJoint && toJoint && (
          <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2.5 text-xs">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <span className="font-medium text-foreground truncate">{fromJoint.label}</span>
            </div>
            <span className="text-muted-foreground shrink-0">✂️</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              <span className="font-medium text-foreground truncate">{toJoint.label}</span>
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Joint Type */}
          <div className="grid gap-1.5">
            <Label>Joint Type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {JOINT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setJointType(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all',
                    jointType === t.value
                      ? t.color + ' border-current'
                      : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <span className="text-base">{t.label.split(' ')[0]}</span>
                  <span className="text-[10px] font-semibold leading-tight">
                    {t.label.split(' ').slice(1).join(' ')}
                  </span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="grid gap-1.5">
            <Label htmlFor="splice-label">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="splice-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Splice Box B-3"
              autoFocus
            />
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="splice-notes">Notes</Label>
            <Input
              id="splice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Cable Type + Fiber Count */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="splice-cable">Cable Type</Label>
              <select
                id="splice-cable"
                value={cableType}
                onChange={(e) => setCableType(e.target.value as typeof cableType)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="Single Mode">Single Mode</option>
                <option value="Multi Mode">Multi Mode</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="splice-fibers">Fiber Count</Label>
              <Input
                id="splice-fibers"
                type="number"
                min={1}
                value={fiberCount}
                onChange={(e) => setFiberCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Splice location row */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Splice Location</Label>
              {liveLocation ? (
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium transition-colors',
                    usingLive
                      ? 'text-blue-600'
                      : 'text-muted-foreground hover:text-blue-600',
                  )}
                >
                  <Locate className="size-3" />
                  {usingLive ? 'Using my location' : 'Use my location'}
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Locate className="size-3 opacity-40" />
                  Location unavailable
                </span>
              )}
            </div>
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
              usingLive ? 'border-blue-200 bg-blue-50' : 'border-border bg-muted',
            )}>
              <MapPin className={cn(
                'size-3.5 shrink-0',
                usingLive ? 'text-blue-500' : 'text-muted-foreground',
              )} />
              <span className={cn(
                'font-mono text-xs tabular-nums',
                usingLive ? 'text-blue-700' : 'text-muted-foreground',
              )}>
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </span>
              {usingLive && (
                <span className="ml-auto text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  live
                </span>
              )}
            </div>
            {usingLive && (
              <button
                type="button"
                onClick={() => { setCoords({ lat, lng }); setUsingLive(false); }}
                className="text-[11px] text-muted-foreground hover:text-foreground text-left transition-colors"
              >
                ↩ Revert to marker position
              </button>
            )}
          </div>

          {/* What will happen info */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5 text-xs text-purple-700 space-y-0.5">
            <p className="font-semibold">What happens:</p>
            <p>• The existing segment is deleted</p>
            <p>• Two new segments are created on either side of this joint</p>
            <p>• Distances are auto-calculated from waypoints</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
            >
              {submitting
                ? <><Loader2 className="size-4 animate-spin mr-1" />Splicing...</>
                : <><Scissors className="size-4 mr-1" />Insert Splice</>
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}