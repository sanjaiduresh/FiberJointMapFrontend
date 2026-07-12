import { useState, useRef } from 'react';
import type { CreateJointPayload, JointType, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { AlertCircle, Loader2, Edit3, Building2, CircleDot, Circle, Scissors, MapPin, Navigation, Camera, Trash2, X, Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import IconPicker from './IconPicker';


interface EditJointModalProps {
  joint: FiberJoint;
  onSubmit: (payload: Partial<CreateJointPayload>) => Promise<void>;
  onMoveLocation: () => void;
  onUploadPhoto?: (file: File) => Promise<void>;
  onDeletePhoto?: (publicId: string) => Promise<void>;
  onClose: () => void;
}


const JOINT_TYPES: { value: JointType; label: string; desc: string; color: string; icon: React.ElementType }[] = [
  { value: 'Base', label: 'Base', desc: 'ISP head-end / central', color: 'border-orange-400 bg-orange-50 text-orange-700', icon: Building2 },
  { value: 'Main', label: 'Main Point', desc: 'Primary distribution joint', color: 'border-blue-400 bg-blue-50 text-blue-700', icon: CircleDot },
  { value: 'Sub', label: 'Sub Point', desc: 'End distribution joint', color: 'border-yellow-400 bg-yellow-50 text-yellow-700', icon: Circle },
  { value: 'Splice', label: 'Splice', desc: 'Mid-cable splice point', color: 'border-purple-400 bg-purple-50 text-purple-700', icon: Scissors },
];


export default function EditJointModal({
  joint, onSubmit, onMoveLocation, onUploadPhoto, onDeletePhoto, onClose,
}: EditJointModalProps) {
  const [label, setLabel] = useState(joint.label);
  const [notes, setNotes] = useState(joint.notes || '');
  const [jointType, setJointType] = useState<JointType>(joint.jointType);
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(joint.cableType);
  const [fiberCount, setFiberCount] = useState(joint.fiberCount);
  const [icon, setIcon] = useState(joint.icon || 'default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
        icon,
      });
      onClose();
    } catch {
      setError('Failed to update joint');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadPhoto) return;
    
    setUploading(true);
    setError('');
    try {
      await onUploadPhoto(file);
    } catch {
      setError('Failed to upload photo');
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (publicId: string) => {
    if (!onDeletePhoto) return;
    if (!confirm('Delete this photo?')) return;
    try {
      await onDeletePhoto(publicId);
    } catch {
      setError('Failed to delete photo');
    }
  };

  const photos = joint.photos || [];

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <Edit3 className="size-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle>Edit Joint</DialogTitle>
                <DialogDescription>
                  Update details, photos, or move this joint.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-3">

            {/* Joint Type */}
            <div className="grid gap-1.5">
              <Label>Joint Type <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-4 gap-1.5">
                {JOINT_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setJointType(t.value)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 text-center transition-all cursor-pointer',
                        jointType === t.value
                          ? t.color + ' border-current'
                          : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      <Icon className="size-4 mb-0.5" />
                      <span className="text-[11px] font-semibold leading-tight">
                        {t.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground leading-tight hidden sm:block">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
            {/* Label */}
            <div className="grid gap-1.5 flex-1">
              <Label htmlFor="joint-label">Label <span className="text-destructive">*</span></Label>
              <Input
                id="joint-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Junction Box A"
                autoFocus
              />
            </div>

            {/* Icon Picker */}
            <IconPicker value={icon} onChange={setIcon} jointType={jointType} />
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
                  Photos ({photos.length})
                </Label>
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 cursor-pointer"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="size-3 animate-spin" /> Uploading...</>
                    ) : (
                      <><Camera className="size-3" /> Take Photo</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 cursor-pointer"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {!uploading && <><Upload className="size-3" /> Upload</>}
                  </Button>
                </div>
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, i) => (
                    <div
                      key={photo.publicId}
                      className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square cursor-pointer"
                      onClick={() => setPreviewUrl(photo.url)}
                    >
                      <img
                        src={photo.url}
                        alt={`Joint photo ${i + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      {onDeletePhoto && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.publicId);
                          }}
                          className="absolute top-1 right-1 size-6 rounded-full bg-red-500 text-white flex items-center justify-center transition-colors hover:bg-red-600 cursor-pointer shadow-sm"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-border rounded-lg bg-muted/30">
                  <ImageIcon className="size-8 text-muted-foreground/40 mb-1" />
                  <p className="text-xs text-muted-foreground">No photos yet</p>
                  <p className="text-[10px] text-muted-foreground/70">Click "Add Photo" to upload</p>
                </div>
              )}
            </div>
            
            <div className="grid gap-1.5 pt-1">
              <Label>Location</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-start text-muted-foreground hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 cursor-pointer"
                  onClick={onMoveLocation}
                >
                  <MapPin className="size-4 mr-2 shrink-0" />
                  <span className="truncate">Move Location</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-start text-muted-foreground hover:text-green-600 hover:border-green-200 hover:bg-green-50 cursor-pointer"
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${joint.lat},${joint.lng}`, '_blank')}
                >
                  <Navigation className="size-4 mr-2 shrink-0" />
                  <span className="truncate">Get Direction</span>
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer">
                {submitting
                  ? <><Loader2 className="size-4 animate-spin mr-1" />Saving...</>
                  : 'Save Changes'
                }
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      {/* Full-size photo preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 size-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={previewUrl}
            alt="Full size preview"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
