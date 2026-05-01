import { useState } from 'react';
import type { FiberJoint } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Building } from 'lucide-react';

interface SettingsModalProps {
  baseJoint: FiberJoint | null;
  onClose: () => void;
  onDeleteBase: (id: string) => Promise<void>;
  onCreateBase: (lat: number, lng: number, label: string) => Promise<void>;
}

export default function SettingsModal({ baseJoint, onClose, onDeleteBase, onCreateBase }: SettingsModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('Base Station');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');

  const handleDelete = async () => {
    if (!baseJoint || !confirm('Delete the base joint? This will also delete all connected segments.')) return;
    setDeleting(true);
    try { await onDeleteBase(baseJoint.id); }
    finally { setDeleting(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try { await onCreateBase(parseFloat(newLat), parseFloat(newLng), newLabel); }
    finally { setCreating(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Building className="size-5 text-orange-500" />
            </div>
            <DialogTitle>Settings</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold">Base Station</p>
            {baseJoint ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>🏢</span>
                  <span className="font-medium text-foreground">{baseJoint.label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {baseJoint.lat.toFixed(6)}, {baseJoint.lng.toFixed(6)}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete Base Station
                </Button>
              </>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <p className="text-xs text-muted-foreground">No base station set. Create one:</p>
                <div className="grid gap-1.5">
                  <Label>Label</Label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Latitude</Label>
                    <Input placeholder="8.3366" value={newLat} onChange={(e) => setNewLat(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Longitude</Label>
                    <Input placeholder="77.8698" value={newLng} onChange={(e) => setNewLng(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="size-4 animate-spin" /> : '🏢 Set Base Station'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}