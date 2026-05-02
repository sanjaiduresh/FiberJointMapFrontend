import { useState } from 'react';
import type { CreateJointPayload, JointType, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Edit3, Building2, CircleDot, Circle, Scissors, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';


interface EditJointModalProps {
  joint: FiberJoint;
  onSubmit: (payload: Partial<CreateJointPayload>) => Promise<void>;
  onMoveLocation: () => void;
  onClose: () => void;
}


const JOINT_TYPES: { value: JointType; label: string; desc: string; color: string; icon: React.ElementType }[] = [
  { value: 'Base', label: 'Base', desc: 'ISP head-end / central', color: 'border-orange-400 bg-orange-50 text-orange-700', icon: Building2 },
  { value: 'Main', label: 'Main Point', desc: 'Primary distribution joint', color: 'border-blue-400 bg-blue-50 text-blue-700', icon: CircleDot },
  { value: 'Sub', label: 'Sub Point', desc: 'End distribution joint', color: 'border-yellow-400 bg-yellow-50 text-yellow-700', icon: Circle },
  { value: 'Splice', label: 'Splice', desc: 'Mid-cable splice point', color: 'border-purple-400 bg-purple-50 text-purple-700', icon: Scissors },
];


export default function EditJointModal({
  joint, onSubmit, onMoveLocation, onClose,
}: EditJointModalProps) {
  const [label, setLabel] = useState(joint.label);
  const [notes, setNotes] = useState(joint.notes || '');
  const [jointType, setJointType] = useState<JointType>(joint.jointType);
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(joint.cableType);
  const [fiberCount, setFiberCount] = useState(joint.fiberCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError('Label is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        label: label.trim(),
        notes,
        jointType,
        cableType,
        fiberCount,
      });
      onClose();
    } catch {
      setError('Failed to update joint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Edit3 className="size-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>Edit Joint</DialogTitle>
              <DialogDescription>
                Update details or move this joint.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">

          {/* Joint Type */}
          <div className="grid gap-1.5">
            <Label>Joint Type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-4 gap-2">
              {JOINT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
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
                    <Icon className="size-5 mb-1" />
                    <span className="text-[12px] font-semibold leading-tight">
                      {t.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div className="grid gap-1.5">
            <Label htmlFor="joint-label">Label <span className="text-destructive">*</span></Label>
            <Input
              id="joint-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Junction Box A"
              autoFocus
            />
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="joint-notes">Notes</Label>
            <Input
              id="joint-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Cable Type + Fiber Count */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="joint-cable">Cable Type</Label>
              <Select value={cableType} onValueChange={(v) => setCableType(v as 'Single Mode' | 'Multi Mode')}>
                <SelectTrigger id="joint-cable">
                  <span className="flex-1 text-left truncate">{cableType || <span className="text-muted-foreground">Select type</span>}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single Mode" label="Single Mode">Single Mode</SelectItem>
                  <SelectItem value="Multi Mode" label="Multi Mode">Multi Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="joint-fibers">Fiber Count</Label>
              <Input
                id="joint-fibers"
                type="number"
                min={1}
                value={fiberCount}
                onChange={(e) => setFiberCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          
          <div className="grid gap-1.5 pt-1">
            <Label>Location</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
              onClick={onMoveLocation}
            >
              <MapPin className="size-4 mr-2" />
              Move Location on Map
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {submitting
                ? <><Loader2 className="size-4 animate-spin mr-1" />Saving...</>
                : 'Save Changes'
              }
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
