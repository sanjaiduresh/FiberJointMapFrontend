import { useState } from 'react';
import type { CreateJointPayload, JointType } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { AlertCircle, MapPin, Building2, CircleDot, Circle, Scissors, Camera, Upload, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';


interface AddJointModalProps {
  onSubmit: (payload: Omit<CreateJointPayload, 'lat' | 'lng'>) => void;
  onClose: () => void;
  defaultType?: JointType;
}


const JOINT_TYPES: { value: JointType; label: string; desc: string; color: string; icon: React.ElementType }[] = [
  { value: 'Base', label: 'Base', desc: 'ISP head-end / central', color: 'border-orange-400 bg-orange-50 text-orange-700', icon: Building2 },
  { value: 'Main', label: 'Main Point', desc: 'Primary distribution joint', color: 'border-blue-400 bg-blue-50 text-blue-700', icon: CircleDot },
  { value: 'Sub', label: 'Sub Point', desc: 'End distribution joint', color: 'border-yellow-400 bg-yellow-50 text-yellow-700', icon: Circle },
  { value: 'Splice', label: 'Splice', desc: 'Mid-cable splice point', color: 'border-purple-400 bg-purple-50 text-purple-700', icon: Scissors },
];


export default function AddJointModal({
  onSubmit, onClose, defaultType = 'Main',
}: AddJointModalProps) {
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [jointType, setJointType] = useState<JointType>(defaultType);
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>('Single Mode');
  const [fiberCount, setFiberCount] = useState(12);
  const [error, setError] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingPhotos(prev => [...prev, file]);
    }
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError('Label is required'); return; }
    setError('');
    onSubmit({
      label: label.trim(),
      notes,
      jointType,
      cableType,
      fiberCount,
      pendingPhotos,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <MapPin className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>Add Joint</DialogTitle>
              <DialogDescription>
                Provide details for the new joint.
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
          {/* Photos Section */}
          <div className="grid gap-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Camera className="size-4 text-muted-foreground" />
                Photos ({pendingPhotos.length})
              </Label>
              <div className="flex gap-1.5">
                <label className="flex h-7 items-center gap-1 cursor-pointer rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                  <Camera className="size-3" /> Take Photo
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                </label>
                <label className="flex h-7 items-center gap-1 cursor-pointer rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                  <Upload className="size-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              </div>
            </div>

            {pendingPhotos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pendingPhotos.map((file, i) => (
                  <div key={i} className="relative shrink-0 size-16 rounded-md border border-border overflow-hidden group">
                    <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 size-5 rounded-full bg-red-500 text-white flex items-center justify-center transition-colors hover:bg-red-600 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <Button type="submit" className="flex-1">
              Next: Place on Map <MapPin className="size-4 ml-1" />
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}